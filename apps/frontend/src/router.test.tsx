import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { routes } from './router'

// Маршруты приложения в памяти — тот же список, что и в браузере (ADR-0001).
// Запросы getBy*/findBy* сами являются проверками: без найденного элемента тест падает.
const renderAt = (path: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [path] })}
    />,
  )

beforeEach(() => {
  // Граница системы: статус сервиса в подвале запрашивает /api/health.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json({ status: 'ok' }))),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('главная страница', () => {
  test('рассказывает о сервисе и ведёт гостя к записи', async () => {
    renderAt('/')

    const main = within(await screen.findByRole('main'))
    main.getByRole('heading', { level: 1, name: 'Календарь звонков' })
    main.getByText(
      'Выберите тип встречи, удобный день и свободное время — и запишитесь на звонок без регистрации.',
    )
    expect(
      main.getByRole('link', { name: 'Записаться' }).getAttribute('href'),
    ).toBe('/book')
  })
})

describe('страница записи', () => {
  test('открывается по кнопке «Записаться» и пока сообщает, что запись недоступна', async () => {
    renderAt('/')

    const main = within(await screen.findByRole('main'))
    fireEvent.click(main.getByRole('link', { name: 'Записаться' }))

    await screen.findByRole('heading', {
      level: 1,
      name: 'Запись на встречу',
    })
    screen.getByText(/Запись пока недоступна\./)
  })
})

describe('неизвестный адрес', () => {
  test('показывает «Страница не найдена» со ссылкой на главную', async () => {
    renderAt('/abc')

    await screen.findByRole('heading', {
      level: 1,
      name: 'Страница не найдена',
    })
    expect(
      within(screen.getByRole('main'))
        .getByRole('link', { name: 'На главную' })
        .getAttribute('href'),
    ).toBe('/')
  })
})
