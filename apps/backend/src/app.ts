import Fastify, { type FastifyServerOptions } from 'fastify'
import { openapiComponentsSchema, responseSchema } from './contract.ts'
import { createStore, type Store } from './store.ts'

export type AppOptions = FastifyServerOptions & {
  /** Хранилище данных; по умолчанию — пустое. */
  store?: Store
}

// Фабрика приложения отделена от запуска сервера,
// чтобы в тестах использовать app.inject() или слушать случайный порт.
export function buildApp({
  store = createStore(),
  ...options
}: AppOptions = {}) {
  const app = Fastify(options)

  app.addSchema(openapiComponentsSchema)

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

  return app
}
