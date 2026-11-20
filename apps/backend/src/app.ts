import Fastify, {
  type FastifySchemaValidationError,
  type FastifyServerOptions,
} from 'fastify'
import { Temporal } from 'temporal-polyfill'
import { meetingTypeAvailability } from './availability.ts'
import {
  openapiComponentsSchema,
  requestBodySchema,
  responseSchema,
} from './contract.ts'
import {
  ApiError,
  fieldErrorsFromSchema,
  meetingTypeNotFound,
  mergeFieldErrors,
  registerErrorHandler,
  validationError,
} from './errors.ts'
import type { MeetingType } from './generated/index.ts'
import {
  meetingTypeRuleErrors,
  normalizeMeetingTypeInput,
} from './meeting-types.ts'
import { createStore, type Store } from './store.ts'

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
        response: { 200: responseSchema('/api/meeting-types', 'get', 200) },
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
        response: { 201: responseSchema('/api/meeting-types', 'post', 201) },
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
        response: {
          200: responseSchema('/api/meeting-types/{id}', 'get', 200),
          404: responseSchema('/api/meeting-types/{id}', 'get', 404),
        },
      },
    },
    (request) => findMeetingType(request.params.id),
  )

  app.get<{ Params: { id: string } }>(
    '/api/meeting-types/:id/availability',
    {
      schema: {
        response: {
          200: responseSchema(
            '/api/meeting-types/{id}/availability',
            'get',
            200,
          ),
          404: responseSchema(
            '/api/meeting-types/{id}/availability',
            'get',
            404,
          ),
        },
      },
    },
    (request) =>
      meetingTypeAvailability(
        findMeetingType(request.params.id).durationMinutes,
        now(),
      ),
  )

  return app
}
