import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { MeetingTypeAvailability } from '@/client'
import { availability } from '@/testing/availability'
import { stubFetch } from '@/testing/fetch'
import { routes } from '@/router'

// Подтверждение бронирования на /book/:typeId/confirm?startsAt=…
// (docs/specs/booking.md §6.1, §6.3). Граница — только fetch.

const meetingType = {
  id: 'intro-call',
  title: 'Знакомство',
  durationMinutes: 60,
}

const startsAt = '2026-11-23T10:00:00+01:00'
const confirmPath = `/book/intro-call/confirm?${new URLSearchParams({ startsAt }).toString()}`

const booking = {
  id: 'b-1',
  meetingTypeId: 'intro-call',
  startsAt,
  endsAt: '2026-11-23T11:00:00+01:00',
  guestName: 'Анна',
  guestEmail: 'anna@example.com',
  createdAt: '2026-11-20T15:00:00+01:00',
}

// Backend в памяти теста: доступность меняется после бронирования или конфликта.
function stubApi(
  onBook: (body: Record<string, unknown>) => Response | Promise<Response>,
  afterBooking: MeetingTypeAvailability = availability(),
) {
  let current = availability()
  const requests: Record<string, unknown>[] = []
  let availabilityRequests = 0
  stubFetch({
    '/api/meeting-types': () => Response.json([meetingType]),
    '/api/meeting-types/intro-call': () => Response.json(meetingType),
    '/api/meeting-types/intro-call/availability': () => {
      availabilityRequests += 1
      return Response.json(current)
    },
    '/api/bookings': async (request) => {
      const body = (await request.json()) as Record<string, unknown>
      requests.push(body)
      current = afterBooking
      return onBook(body)
    },
  })
  return { requests, availabilityRequests: () => availabilityRequests }
}

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const fillAndSubmit = async (name = 'Анна', email = 'anna@example.com') => {
  fireEvent.change(await screen.findByLabelText('Имя'), {
    target: { value: name },
  })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: 'Подтвердить запись' }))
}

const errorResponse = (status: number, body: Record<string, unknown>) =>
  Response.json({ message: 'error', ...body }, { status })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('подтверждение бронирования', () => {
  test('сводка: тип, длительность, день, время, часовой пояс; поля и «Изменить»', async () => {
    stubApi(() => Response.json(booking, { status: 201 }))

    renderAt(confirmPath)

    await screen.findByRole('heading', { level: 1 })
    const summary = within(screen.getByRole('complementary'))
    summary.getByText('Знакомство')
    summary.getByText('1 ч')
    summary.getByText('понедельник, 23 ноября')
    summary.getByText('10:00–11:00')
    summary.getByText('Europe/Warsaw')
    const name = screen.getByLabelText<HTMLInputElement>('Имя')
    const email = screen.getByLabelText<HTMLInputElement>('Email')
    expect(name.required).toBe(true)
    expect(email.required).toBe(true)
    expect(email.type).toBe('email')
    expect(
      screen.getByRole('link', { name: 'Изменить' }).getAttribute('href'),
    ).toBe('/book/intro-call?date=2026-11-23')
  })

  test('успех: отправляет тип, слот и данные гостя и показывает экран успеха', async () => {
    const api = stubApi(() => Response.json(booking, { status: 201 }))

    renderAt(confirmPath)
    await fillAndSubmit()

    await screen.findByText('Бронирование подтверждено. До встречи!')
    expect(api.requests).toEqual([
      {
        meetingTypeId: 'intro-call',
        startsAt,
        guestName: 'Анна',
        guestEmail: 'anna@example.com',
      },
    ])
    screen.getByText('Знакомство')
    screen.getByText('понедельник, 23 ноября')
    screen.getByText('10:00–11:00')
    screen.getByText('Europe/Warsaw')
    // §6.3: только тип, день, время, часовой пояс.
    expect(screen.queryByText('Длительность')).toBe(null)
    expect(screen.queryByText('1 ч')).toBe(null)
    expect(
      screen
        .getByRole('link', { name: 'Забронировать ещё' })
        .getAttribute('href'),
    ).toBe('/book')
    expect(screen.queryByRole('button', { name: 'Подтвердить запись' })).toBe(
      null,
    )
  })

  test('«Подтвердить запись» заблокирована на время отправки', async () => {
    let respond: (response: Response) => void = () => undefined
    stubApi(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve
        }),
    )

    renderAt(confirmPath)
    await fillAndSubmit()

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'Подтвердить запись' })
          .hasAttribute('disabled'),
      ).toBe(true)
    })
    respond(Response.json(booking, { status: 201 }))
    await screen.findByText('Бронирование подтверждено. До встречи!')
  })

  test('ошибки полей — у полей, тексты по кодам', async () => {
    stubApi(() =>
      errorResponse(400, {
        code: 'VALIDATION_ERROR',
        fieldErrors: [
          { field: 'guestName', code: 'TOO_LONG' },
          { field: 'guestEmail', code: 'INVALID_FORMAT' },
        ],
      }),
    )

    renderAt(confirmPath)
    await fillAndSubmit('Анна', 'anna@example')

    await screen.findByText('Имя — не длиннее 100 символов')
    screen.getByText('Укажите корректный email')
    expect(screen.getByLabelText('Имя').getAttribute('aria-invalid')).toBe(
      'true',
    )
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe(
      'true',
    )
  })

  test.each([
    ['guestName', 'REQUIRED', 'Укажите имя'],
    ['guestEmail', 'REQUIRED', 'Укажите email'],
    ['guestEmail', 'TOO_LONG', 'Email — не длиннее 254 символов'],
  ])('%s %s — «%s»', async (field, code, text) => {
    stubApi(() =>
      errorResponse(400, {
        code: 'VALIDATION_ERROR',
        fieldErrors: [{ field, code }],
      }),
    )

    renderAt(confirmPath)
    await fillAndSubmit()

    await screen.findByText(text)
  })

  test('SLOT_TAKEN — возврат к тому же дню с обновлённой доступностью и сообщением', async () => {
    const api = stubApi(
      () => errorResponse(409, { code: 'SLOT_TAKEN' }),
      availability({ '2026-11-23': ['10:00'] }),
    )

    const router = renderAt(confirmPath)
    await fillAndSubmit()

    await screen.findByText('Это время уже заняли. Выберите другое.')
    expect(router.state.location.pathname).toBe('/book/intro-call')
    expect(new URLSearchParams(router.state.location.search).get('date')).toBe(
      '2026-11-23',
    )
    const slots = within(screen.getByRole('list', { name: 'Время' }))
    expect(
      slots
        .getByRole('button', { name: '10:00 Занято' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(api.availabilityRequests()).toBeGreaterThanOrEqual(2)
  })

  test('INVALID_SLOT у startsAt — возврат к дню с сообщением о недоступном времени', async () => {
    stubApi(() =>
      errorResponse(400, {
        code: 'VALIDATION_ERROR',
        fieldErrors: [{ field: 'startsAt', code: 'INVALID_SLOT' }],
      }),
    )

    const router = renderAt(confirmPath)
    await fillAndSubmit()

    await screen.findByText('Это время недоступно для записи. Выберите другое.')
    expect(router.state.location.pathname).toBe('/book/intro-call')
  })

  test('MEETING_TYPE_NOT_FOUND — «Тип встречи не найден» и ссылка «К каталогу»', async () => {
    stubApi(() => errorResponse(404, { code: 'MEETING_TYPE_NOT_FOUND' }))

    renderAt(confirmPath)
    await fillAndSubmit()

    await screen.findByText('Тип встречи не найден')
    expect(
      screen.getByRole('link', { name: 'К каталогу' }).getAttribute('href'),
    ).toBe('/book')
    expect(
      screen.queryByText('Не удалось отправить. Попробуйте ещё раз.'),
    ).toBe(null)
  })

  test('сеть или 5xx — «Не удалось отправить. Попробуйте ещё раз.»', async () => {
    stubApi(() => Response.json({}, { status: 500 }))

    renderAt(confirmPath)
    await fillAndSubmit()

    await screen.findByText('Не удалось отправить. Попробуйте ещё раз.')
    expect(
      screen
        .getByRole('button', { name: 'Подтвердить запись' })
        .hasAttribute('disabled'),
    ).toBe(false)
  })

  test('startsAt с другим смещением — тот же момент, слот найден', async () => {
    stubApi(() => Response.json(booking, { status: 201 }))

    const router = renderAt(
      `/book/intro-call/confirm?${new URLSearchParams({ startsAt: '2026-11-23T09:00:00Z' }).toString()}`,
    )

    await screen.findByRole('button', { name: 'Подтвердить запись' })
    expect(router.state.location.pathname).toBe('/book/intro-call/confirm')
    within(screen.getByRole('complementary')).getByText('10:00–11:00')
  })

  test('SLOT_TAKEN для слота в UTC — возврат к местному дню часового пояса из ответа', async () => {
    // Слот 00:00 по Варшаве 24 ноября записан в UTC: дата в строке — 23 ноября.
    const utcStartsAt = '2026-11-23T23:00:00Z'
    const withUtcSlot = (busy: Record<string, string[]> = {}) => {
      const response = availability(busy)
      const day = response.days.find(({ date }) => date === '2026-11-24')
      day?.slots.unshift({
        startsAt: utcStartsAt,
        endsAt: '2026-11-24T00:00:00Z',
        available: true,
      })
      return response
    }
    let current = withUtcSlot()
    stubFetch({
      '/api/meeting-types/intro-call': () => Response.json(meetingType),
      '/api/meeting-types/intro-call/availability': () =>
        Response.json(current),
      '/api/bookings': () => {
        current = withUtcSlot()
        return errorResponse(409, { code: 'SLOT_TAKEN' })
      },
    })

    const router = renderAt(
      `/book/intro-call/confirm?${new URLSearchParams({ startsAt: utcStartsAt }).toString()}`,
    )
    await fillAndSubmit()

    await screen.findByText('Это время уже заняли. Выберите другое.')
    expect(new URLSearchParams(router.state.location.search).get('date')).toBe(
      '2026-11-24',
    )
  })

  test('startsAt не начало слота — переход к выбору дня', async () => {
    stubApi(() => Response.json(booking, { status: 201 }))

    const router = renderAt(
      `/book/intro-call/confirm?${new URLSearchParams({ startsAt: '2026-11-23T10:15:00+01:00' }).toString()}`,
    )

    await screen.findByRole('grid')
    expect(router.state.location.pathname).toBe('/book/intro-call')
  })
})
