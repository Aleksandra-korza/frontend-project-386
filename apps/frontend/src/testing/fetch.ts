import { vi } from 'vitest'

type Handler = () => Response | Promise<Response>

// Граница системы в тестах страниц — только fetch (docs/specs/booking.md §7).
// Ответ выбирается по пути запроса; неизвестный путь — 404, как у backend.
export function stubFetch(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      window.location.href,
    )
    const handler = handlers[url.pathname]
    return Promise.resolve(
      handler ? handler() : Response.json({}, { status: 404 }),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
}
