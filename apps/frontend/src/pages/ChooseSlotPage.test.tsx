import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { AvailabilityDay, MeetingTypeAvailability } from '@/client'
import { routes } from '@/router'
import { stubFetch } from '@/testing/fetch'

// Выбор дня и времени на /book/:typeId?date= (docs/specs/booking.md §6.1, §6.3).

const meetingType = {
  id: 'intro-call',
  title: 'Знакомство',
  durationMinutes: 60,
}

// Ответ доступности для окна 2026-11-21…2026-12-04: в каждом дне слоты 60 минут
// 09:00…17:00 (+01:00). `busy` — занятые слоты: день → времена начала.
function availability(
  busy: Record<string, string[]> = {},
): MeetingTypeAvailability {
  const days: AvailabilityDay[] = []
  for (let day = 21; day <= 34; day += 1) {
    const date =
      day <= 30
        ? `2026-11-${String(day)}`
        : `2026-12-${String(day - 30).padStart(2, '0')}`
    const slots = Array.from({ length: 17 }, (_, index) => {
      const hours = 9 + Math.floor(index / 2)
      const minutes = index % 2 === 0 ? '00' : '30'
      const time = `${String(hours).padStart(2, '0')}:${minutes}`
      const endHours = String(hours + 1).padStart(2, '0')
      return {
        startsAt: `${date}T${time}:00+01:00`,
        endsAt: `${date}T${endHours}:${minutes}:00+01:00`,
        available: !(busy[date] ?? []).includes(time),
      }
    })
    days.push({ date, slots })
  }
  return {
    timeZone: 'Europe/Warsaw',
    window: { from: '2026-11-21', to: '2026-12-04' },
    days,
  }
}

const allTimes = Array.from(
  { length: 17 },
  (_, index) =>
    `${String(9 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '30'}`,
)

function stubApi(response: MeetingTypeAvailability = availability()) {
  stubFetch({
    '/api/meeting-types': () => Response.json([meetingType]),
    '/api/meeting-types/intro-call': () => Response.json(meetingType),
    '/api/meeting-types/intro-call/availability': () => Response.json(response),
  })
}

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('выбор дня и времени', () => {
  test('без выбранного дня просит выбрать дату и показывает тип, длительность и часовой пояс', async () => {
    stubApi()

    renderAt('/book/intro-call')

    await screen.findByRole('heading', { level: 1, name: 'Знакомство' })
    const panel = within(screen.getByRole('complementary'))
    panel.getByText('1 ч')
    panel.getByText('Выберите дату')
    panel.getByText('Europe/Warsaw')
    expect(screen.queryByRole('button', { name: /Свободно/ })).toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'Продолжить' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  test('календарь Пн–Вс показывает счётчик свободных слотов; занятый полностью день и дни вне окна недоступны', async () => {
    stubApi(
      availability({
        '2026-11-22': allTimes,
        '2026-11-23': ['10:00', '11:30'],
      }),
    )

    renderAt('/book/intro-call')

    const calendar = within(await screen.findByRole('grid'))
    expect(
      calendar.getAllByRole('columnheader').map((cell) => cell.textContent),
    ).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'])
    screen.getByText('Ноябрь 2026')

    const nov21 = calendar.getByRole('button', { name: /^21 ноября/ })
    expect(nov21.hasAttribute('disabled')).toBe(false)
    expect(within(nov21).getByText('17')).toBeTruthy()
    expect(
      within(calendar.getByRole('button', { name: /^23 ноября/ })).getByText(
        '15',
      ),
    ).toBeTruthy()
    expect(
      calendar
        .getByRole('button', { name: /^22 ноября/ })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      calendar
        .getByRole('button', { name: /^20 ноября/ })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  test('месяцы листаются только в пределах окна', async () => {
    stubApi()

    renderAt('/book/intro-call')

    await screen.findByText('Ноябрь 2026')
    const previous = screen.getByRole('button', { name: 'Предыдущий месяц' })
    const next = screen.getByRole('button', { name: 'Следующий месяц' })
    expect(previous.hasAttribute('disabled')).toBe(true)
    expect(next.hasAttribute('disabled')).toBe(false)

    fireEvent.click(next)

    screen.getByText('Декабрь 2026')
    expect(
      screen
        .getByRole('button', { name: 'Следующий месяц' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen
        .getByRole('button', { name: /^4 декабря/ })
        .hasAttribute('disabled'),
    ).toBe(false)
    expect(
      screen
        .getByRole('button', { name: /^5 декабря/ })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  test('день из ?date= выбран: список всех слотов дня, занятые неактивны, счётчик в панели', async () => {
    stubApi(availability({ '2026-11-23': ['10:00', '11:30'] }))

    renderAt('/book/intro-call?date=2026-11-23')

    const slots = within(await screen.findByRole('list', { name: 'Время' }))
    const buttons = slots.getAllByRole('button')
    expect(buttons).toHaveLength(17)
    const free = slots.getByRole('button', { name: '09:00 Свободно' })
    const busy = slots.getByRole('button', { name: '10:00 Занято' })
    expect(free.hasAttribute('disabled')).toBe(false)
    expect(busy.hasAttribute('disabled')).toBe(true)

    expect(
      screen
        .getByRole('button', { name: /^23 ноября/ })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    const panel = within(screen.getByRole('complementary'))
    panel.getByText('понедельник, 23 ноября')
    panel.getByText('15')
    panel.getByText('Выберите время')
  })

  test('выбор дня в календаре открывает его слоты', async () => {
    stubApi()

    const router = renderAt('/book/intro-call')

    fireEvent.click(await screen.findByRole('button', { name: /^25 ноября/ }))

    await screen.findByRole('list', { name: 'Время' })
    expect(router.state.location.search).toBe('?date=2026-11-25')
  })

  test('«Продолжить» доступно только при выбранном свободном слоте и ведёт к подтверждению', async () => {
    stubApi(availability({ '2026-11-23': ['10:00'] }))

    renderAt('/book/intro-call?date=2026-11-23')

    await screen.findByRole('list', { name: 'Время' })
    expect(
      screen
        .getByRole('button', { name: 'Продолжить' })
        .hasAttribute('disabled'),
    ).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '10:00 Занято' }))
    expect(
      screen
        .getByRole('button', { name: 'Продолжить' })
        .hasAttribute('disabled'),
    ).toBe(true)

    const slot = screen.getByRole('button', { name: '10:30 Свободно' })
    fireEvent.click(slot)

    expect(slot.getAttribute('aria-pressed')).toBe('true')
    within(screen.getByRole('complementary')).getByText('10:30–11:30')
    expect(
      screen.getByRole('link', { name: 'Продолжить' }).getAttribute('href'),
    ).toBe(
      `/book/intro-call/confirm?startsAt=${encodeURIComponent('2026-11-23T10:30:00+01:00')}`,
    )
  })

  test('день вне окна или полностью занятый в ?date= не выбирается', async () => {
    stubApi(availability({ '2026-11-22': allTimes }))

    renderAt('/book/intro-call?date=2026-11-22')

    await screen.findByRole('grid')
    within(screen.getByRole('complementary')).getByText('Выберите дату')
    expect(screen.queryByRole('list', { name: 'Время' })).toBeNull()
  })

  test('«Назад» ведёт в каталог', async () => {
    stubApi()

    renderAt('/book/intro-call')

    expect(
      (await screen.findByRole('link', { name: 'Назад' })).getAttribute('href'),
    ).toBe('/book')
  })

  test('неизвестный тип — «Тип встречи не найден» со ссылкой в каталог', async () => {
    const notFound = () =>
      Response.json(
        { code: 'MEETING_TYPE_NOT_FOUND', message: 'Meeting type not found' },
        { status: 404 },
      )
    stubFetch({
      '/api/meeting-types/unknown': notFound,
      '/api/meeting-types/unknown/availability': notFound,
    })

    renderAt('/book/unknown')

    await screen.findByText('Тип встречи не найден')
    expect(
      screen.getByRole('link', { name: 'К каталогу' }).getAttribute('href'),
    ).toBe('/book')
  })
})
