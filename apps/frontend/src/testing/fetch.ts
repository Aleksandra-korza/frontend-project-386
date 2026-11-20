import { vi } from 'vitest'

type Handler = (request: Request) => Response | Promise<Response>

// Граница системы в тестах страниц — только fetch (docs/specs/booking.md §7).
// Ответ выбирается по пути запроса; неизвестный путь — 404, как у backend.
// Обработчик получает запрос: метод и тело для операций записи.
export function stubFetch(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const request =
      input instanceof Request
        ? input
        : new Request(new URL(String(input), window.location.href), init)
    const handler = handlers[new URL(request.url).pathname]
    return Promise.resolve(
      handler ? handler(request) : Response.json({}, { status: 404 }),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
}
