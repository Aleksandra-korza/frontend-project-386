import Fastify, { type FastifyServerOptions } from 'fastify'
import { Temporal } from 'temporal-polyfill'
import { meetingTypeAvailability } from './availability.ts'
import { openapiComponentsSchema, responseSchema } from './contract.ts'
import { meetingTypeNotFound, registerErrorHandler } from './errors.ts'
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
  const app = Fastify(options)

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
