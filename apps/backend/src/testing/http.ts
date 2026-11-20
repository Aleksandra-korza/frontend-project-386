import { buildApp, type AppOptions } from '../app.ts'

// API-тесты ходят в настоящий HTTP-сервер на случайном порту через fetch
// (docs/specs/booking.md §7), а не через app.inject().
export async function startTestServer(options: AppOptions = {}) {
  const app = buildApp(options)
  const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' })

  return {
    request: (path: string, init?: RequestInit) =>
      fetch(`${baseUrl}${path}`, init),
    close: () => app.close(),
  }
}
