import Fastify, { type FastifyServerOptions } from 'fastify'

// Фабрика приложения отделена от запуска сервера,
// чтобы в тестах использовать app.inject() без открытия порта.
export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options)

  app.get('/api/health', () => ({ status: 'ok' }))

  return app
}
