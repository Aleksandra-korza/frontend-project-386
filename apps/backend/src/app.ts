import { randomUUID } from 'node:crypto'
import Fastify, {
  type FastifySchemaValidationError,
  type FastifyServerOptions,
} from 'fastify'
import { Temporal } from 'temporal-polyfill'
import {
  findSlot,
  meetingTypeAvailability,
  type Slot,
  TIME_ZONE,
  toApiDateTime,
} from './availability.ts'
import { normalizeBookingInput } from './bookings.ts'
import {
  openapiComponentsSchema,
  requestBodySchema,
  responseSchemas,
} from './contract.ts'
import {
  ApiError,
  fieldErrorsFromSchema,
  meetingTypeNotFound,
  mergeFieldErrors,
  registerErrorHandler,
  validationError,
} from './errors.ts'
import type {
  Booking,
  CreateBookingRequest,
  FieldError,
  FieldErrorCode,
  MeetingType,
  UpcomingBooking,
} from './generated/index.ts'
import {
  meetingTypeRuleErrors,
  normalizeMeetingTypeInput,
} from './meeting-types.ts'
import { createStore, type Store } from './store.ts'

/** Слот по началу `startsAt` или код ошибки поля `startsAt`. */
type SlotLookup = { ok: true; slot: Slot } | { ok: false; code: FieldErrorCode }

export type AppOptions = FastifyServerOptions & {
  /** Хранилище данных; по умолчанию — пустое. */
  store?: Store
  /** Часы: текущий момент; по умолчанию — системные (ADR-0004, п. 5). */
  now?: () => Temporal.Instant
}

// Фабрика приложения отделена от запуска сервера,
// чтобы в тестах использовать app.inject() или слушать случайный порт.
export function buildApp({
  store = createStore(),
  now = () => Temporal.Now.instant(),
  ...options
}: AppOptions = {}) {
  const app = Fastify({
    ajv: {
      customOptions: {
        // Все ошибки тела сразу (fieldErrors по всем полям, §5).
        allErrors: true,
        // parentSchema в ошибке: код поля зависит от его ограничений.
        verbose: true,
        // Значение не того типа — ошибка формата, а не повод для приведения.
        coerceTypes: false,
        // Компоненты OpenAPI содержат ключи, которых нет в JSON Schema.
        strictSchema: false,
      },
    },
    ...options,
  })

  app.addSchema(openapiComponentsSchema)
  registerErrorHandler(app)

  app.get('/api/health', () => ({ status: 'ok' }))

  app.get(
    '/api/meeting-types',
    {
      schema: {
        response: responseSchemas('/api/meeting-types', 'get', [200]),
      },
    },
    () => store.listMeetingTypes(),
  )

  app.post<{ Body: MeetingType }>(
    '/api/meeting-types',
    {
      // Ошибки схемы объединяются с правилами сверх схемы в одном ответе.
      attachValidation: true,
      schema: {
        body: requestBodySchema('/api/meeting-types', 'post'),
        response: responseSchemas(
          '/api/meeting-types',
          'post',
          [201, 400, 409],
        ),
      },
      preValidation: (request, _reply, done) => {
        request.body = normalizeMeetingTypeInput(request.body)
        done()
      },
    },
    async (request, reply) => {
      const fieldErrors = mergeFieldErrors(
        fieldErrorsFromSchema(
          request.validationError?.validation as
            FastifySchemaValidationError[] | undefined,
        ),
        meetingTypeRuleErrors(request.body),
      )
      if (request.validationError || fieldErrors.length > 0) {
        throw validationError(fieldErrors)
      }
      if (!store.addMeetingType(request.body)) {
        throw new ApiError(
          409,
          'MEETING_TYPE_ID_TAKEN',
          `Meeting type "${request.body.id}" already exists`,
        )
      }
      return reply.code(201).send(request.body)
    },
  )

  const findMeetingType = (id: string) => {
    const meetingType = store.getMeetingType(id)
    if (!meetingType) throw meetingTypeNotFound(id)
    return meetingType
  }

  app.get<{ Params: { id: string } }>(
    '/api/meeting-types/:id',
    {
      schema: {
        response: responseSchemas('/api/meeting-types/{id}', 'get', [200, 404]),
      },
    },
    (request) => findMeetingType(request.params.id),
  )

  app.get<{ Params: { id: string } }>(
    '/api/meeting-types/:id/availability',
    {
      schema: {
        response: responseSchemas(
          '/api/meeting-types/{id}/availability',
          'get',
          [200, 404],
        ),
      },
    },
    (request) =>
      meetingTypeAvailability(
        findMeetingType(request.params.id).durationMinutes,
        now(),
        store.listBookedIntervals(),
      ),
  )

  app.get(
    '/api/bookings',
    {
      schema: {
        response: responseSchemas('/api/bookings', 'get', [200]),
      },
    },
    (): UpcomingBooking[] => store.listUpcomingBookings(now()),
  )

  app.post<{ Body: CreateBookingRequest }>(
    '/api/bookings',
    {
      attachValidation: true,
      schema: {
        body: requestBodySchema('/api/bookings', 'post'),
        response: responseSchemas(
          '/api/bookings',
          'post',
          [201, 400, 404, 409],
        ),
      },
      preValidation: (request, _reply, done) => {
        request.body = normalizeBookingInput(request.body)
        done()
      },
    },
    async (request, reply) => {
      // Порядок проверок — ADR-0003: тип → поля гостя и startsAt → пересечения.
      const body = request.body as Partial<Record<string, unknown>> | undefined
      const meetingTypeId = body?.meetingTypeId
      const meetingType =
        typeof meetingTypeId === 'string' && meetingTypeId !== ''
          ? findMeetingType(meetingTypeId)
          : undefined

      const schemaErrors = fieldErrorsFromSchema(
        request.validationError?.validation as
          FastifySchemaValidationError[] | undefined,
      )
      const found =
        meetingType &&
        typeof body?.startsAt === 'string' &&
        !schemaErrors.some(({ field }) => field === 'startsAt')
          ? slotStartingAt(meetingType.durationMinutes, body.startsAt)
          : undefined
      const slotErrors: FieldError[] =
        found?.ok === false ? [{ field: 'startsAt', code: found.code }] : []
      const fieldErrors = mergeFieldErrors(schemaErrors, slotErrors)
      if (
        request.validationError ||
        fieldErrors.length > 0 ||
        found?.ok !== true
      ) {
        throw validationError(fieldErrors)
      }
      const { slot } = found

      const booking: Booking = {
        id: randomUUID(),
        meetingTypeId: request.body.meetingTypeId,
        startsAt: toApiDateTime(slot.startsAt),
        endsAt: toApiDateTime(slot.endsAt),
        guestName: request.body.guestName,
        guestEmail: request.body.guestEmail,
        createdAt: toApiDateTime(now().toZonedDateTimeISO(TIME_ZONE)),
      }
      // Проверка пересечений и вставка — одна синхронная операция (ADR-0003).
      if (!store.addBookingIfFree(booking)) {
        throw new ApiError(
          409,
          'SLOT_TAKEN',
          'The selected time is already booked',
        )
      }
      return reply.code(201).send(booking)
    },
  )

  // Слот типа, начинающийся в `startsAt`, той же функцией сетки, что и доступность;
  // иначе — ошибка поля: строка не момент времени или не начало допустимого слота.
  function slotStartingAt(
    durationMinutes: number,
    startsAt: string,
  ): SlotLookup {
    let instant: Temporal.Instant
    try {
      instant = Temporal.Instant.from(startsAt)
    } catch {
      return { ok: false, code: 'INVALID_FORMAT' }
    }
    const slot = findSlot(durationMinutes, now(), instant)
    return slot ? { ok: true, slot } : { ok: false, code: 'INVALID_SLOT' }
  }

  return app
}
