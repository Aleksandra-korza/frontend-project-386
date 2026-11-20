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
import { routes } from '@/router'
import { stubFetch } from '@/testing/fetch'

// Каталог типов встреч на /book (docs/specs/booking.md §6.1, §6.3).
const renderBookPage = () =>
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/book'] })}
    />,
  )

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('каталог типов встреч', () => {
  test('показывает типы встреч в порядке ответа: название, описание, длительность и ссылку на выбор времени', async () => {
    stubFetch({
      '/api/meeting-types': () =>
        Response.json([
          { id: 'intro-call', title: 'Знакомство', durationMinutes: 30 },
          {
            id: 'consultation',
            title: 'Консультация',
            description: 'Разбор вашего вопроса',
            durationMinutes: 90,
          },
          { id: 'workshop', title: 'Воркшоп', durationMinutes: 60 },
        ]),
    })

    renderBookPage()

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(3)
    const [intro, consultation, workshop] = items.map((item) => within(item))

    intro.getByRole('heading', { level: 2, name: 'Знакомство' })
    intro.getByText('30 мин')
    expect(intro.getByRole('link').getAttribute('href')).toBe(
      '/book/intro-call',
    )

    consultation.getByRole('heading', { level: 2, name: 'Консультация' })
    consultation.getByText('Разбор вашего вопроса')
    consultation.getByText('1 ч 30 мин')
    expect(consultation.getByRole('link').getAttribute('href')).toBe(
      '/book/consultation',
    )

    workshop.getByText('1 ч')
  })

  test('без типов встреч сообщает, что их пока нет', async () => {
    stubFetch({
      '/api/meeting-types': () => Response.json([]),
    })

    renderBookPage()

    await screen.findByText('Пока нет доступных типов встреч')
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  test('пока каталог загружается, показывает индикатор загрузки', async () => {
    let respond: (response: Response) => void = () => {}
    stubFetch({
      '/api/meeting-types': () =>
        new Promise<Response>((resolve) => {
          respond = resolve
        }),
    })

    renderBookPage()

    await screen.findByRole('status')
    screen.getByText('Загрузка…')

    respond(Response.json([]))
    await screen.findByText('Пока нет доступных типов встреч')
  })

  test('при ошибке загрузки предлагает повторить, и повтор показывает каталог', async () => {
    let failing = true
    stubFetch({
      '/api/meeting-types': () =>
        failing
          ? Response.json({}, { status: 500 })
          : Response.json([
              { id: 'intro-call', title: 'Знакомство', durationMinutes: 30 },
            ]),
    })

    renderBookPage()

    await screen.findByText('Не удалось загрузить данные')
    failing = false
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    await screen.findByRole('heading', { level: 2, name: 'Знакомство' })
    expect(screen.queryByText('Не удалось загрузить данные')).toBeNull()
  })
})
