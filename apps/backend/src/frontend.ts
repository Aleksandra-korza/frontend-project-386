import fastifyStatic from '@fastify/static'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { ApiError } from './errors.ts'

const pathOf = (request: FastifyRequest) => request.url.split('?')[0]

const isApi = (path: string) => path === '/api' || path.startsWith('/api/')

// Клиентский адрес React Router (ADR-0001): GET/HEAD, ожидающий HTML.
const wantsHtml = (request: FastifyRequest) =>
  (request.method === 'GET' || request.method === 'HEAD') &&
  !isApi(pathOf(request)) &&
  (request.headers.accept ?? '').includes('text/html')

/**
 * Неизвестные адреса: `/api/*` — всегда JSON `404 NOT_FOUND`; с каталогом
 * статики — существующий файл отдаётся `@fastify/static`, а клиентский адрес
 * получает `index.html` (docs/specs/deploy.md §2, ADR-0006).
 */
export function registerFrontend(
  app: FastifyInstance,
  staticDir: string | undefined,
) {
  if (staticDir) {
    // Регистрация попадает в очередь плагинов и завершается до listen/ready.
    void app.register(fastifyStatic, { root: staticDir })
  }

  app.setNotFoundHandler((request, reply) => {
    if (staticDir && wantsHtml(request)) {
      return reply.type('text/html').sendFile('index.html')
    }
    const error = new ApiError(
      404,
      'NOT_FOUND',
      `Route ${request.method} ${pathOf(request)} not found`,
    )
    return reply.code(404).send(error.toResponse())
  })
}
