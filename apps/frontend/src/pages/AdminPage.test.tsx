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

// «Раздел владельца» /admin: секции «Предстоящие бронирования» и «Типы встреч»
// (docs/specs/booking.md §6.2, §6.3).
const renderAdminPage = () =>
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/admin'] })}
    />,
  )

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

type MeetingType = {
  id: string
  title: string
  description?: string
  durationMinutes: number
}

type UpcomingBooking = {
  id: string
  meetingTypeId: string
  meetingTypeTitle: string
  startsAt: string
  endsAt: string
  guestName: string
  guestEmail: string
  createdAt: string
}

// Backend в памяти теста: GET отдаёт список, POST отвечает переданной функцией.
// Предстоящих бронирований нет, если не переданы.
function stubMeetingTypesApi(
  initial: MeetingType[],
  onCreate: (body: Record<string, unknown>) => Response = (body) =>
    Response.json(body, { status: 201 }),
  bookings: UpcomingBooking[] = [],
) {
  const meetingTypes = [...initial]
  const created: Record<string, unknown>[] = []
  stubFetch({
    '/api/bookings': () => Response.json(bookings),
    '/api/meeting-types': async (request) => {
      if (request.method !== 'POST') return Response.json(meetingTypes)
      const body = (await request.json()) as Record<string, unknown>
      created.push(body)
      const response = onCreate(body)
      if (response.status === 201) meetingTypes.push(body as MeetingType)
      return response
    },
  })
  return { created }
}

const sectionTitled = async (name: string) =>
  within(
    (await screen.findByRole('heading', { level: 2, name })).closest(
      'section',
    )!,
  )

const section = () => sectionTitled('Типы встреч')
const bookingsSection = () => sectionTitled('Предстоящие бронирования')

function fillForm(fields: {
  id?: string
  title?: string
  description?: string
  duration?: string
}) {
  if (fields.id !== undefined) {
    fireEvent.change(screen.getByLabelText('Идентификатор (id)'), {
      target: { value: fields.id },
    })
  }
  if (fields.title !== undefined) {
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: fields.title },
    })
  }
  if (fields.description !== undefined) {
    fireEvent.change(screen.getByLabelText('Описание'), {
      target: { value: fields.description },
    })
  }
  if (fields.duration !== undefined) {
    const select = screen.getByLabelText<HTMLSelectElement>('Длительность')
    const option = within(select).getByRole<HTMLOptionElement>('option', {
      name: fields.duration,
    })
    fireEvent.change(select, { target: { value: option.value } })
  }
}

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

describe('раздел владельца: типы встреч', () => {
  test('без типов встреч сообщает, что их пока нет', async () => {
    stubMeetingTypesApi([])

    renderAdminPage()

    await screen.findByRole('heading', { level: 1, name: 'Раздел владельца' })
    ;(await section()).getByText('Типов встреч пока нет')
  })

  test('показывает типы встреч в порядке ответа: id, название, длительность, описание', async () => {
    stubMeetingTypesApi([
      { id: 'intro-call', title: 'Знакомство', durationMinutes: 30 },
      {
        id: 'consultation',
        title: 'Консультация',
        description: 'Разбор вашего вопроса',
        durationMinutes: 90,
      },
    ])

    renderAdminPage()

    const items = (await section()).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    const [intro, consultation] = items.map((item) => within(item))
    intro.getByText('intro-call')
    intro.getByText('Знакомство')
    intro.getByText('30 мин')
    consultation.getByText('consultation')
    consultation.getByText('Консультация')
    consultation.getByText('1 ч 30 мин')
    consultation.getByText('Разбор вашего вопроса')
  })

  test('предлагает длительности от 15 минут до 8 часов с шагом 15 минут', async () => {
    stubMeetingTypesApi([])

    renderAdminPage()

    const select = await screen.findByLabelText('Длительность')
    const options = within(select)
      .getAllByRole<HTMLOptionElement>('option')
      .filter((option) => option.value !== '')
    expect(options).toHaveLength(32)
    expect(options[0]?.textContent).toBe('15 мин')
    expect(options[3]?.textContent).toBe('1 ч')
    expect(options[5]?.textContent).toBe('1 ч 30 мин')
    expect(options.at(-1)?.textContent).toBe('8 ч')
  })

  test('создаёт тип: отправляет поля, сообщает об успехе, обновляет список и очищает форму', async () => {
    const { created } = stubMeetingTypesApi([
      { id: 'intro-call', title: 'Знакомство', durationMinutes: 30 },
    ])
    renderAdminPage()
    await section()

    fillForm({
      id: 'team-sync',
      title: 'Синхронизация',
      description: 'Еженедельная встреча',
      duration: '1 ч 30 мин',
    })
    submit()

    await screen.findByText('Тип встречи создан')
    expect(created).toEqual([
      {
        id: 'team-sync',
        title: 'Синхронизация',
        description: 'Еженедельная встреча',
        durationMinutes: 90,
      },
    ])
    const list = await section()
    await list.findByText('team-sync')
    expect(list.getAllByRole('listitem')).toHaveLength(2)
    expect(
      screen.getByLabelText<HTMLInputElement>('Идентификатор (id)').value,
    ).toBe('')
    expect(screen.getByLabelText<HTMLInputElement>('Название').value).toBe('')
    expect(screen.getByLabelText<HTMLTextAreaElement>('Описание').value).toBe(
      '',
    )
    expect(screen.getByLabelText<HTMLSelectElement>('Длительность').value).toBe(
      '',
    )
  })

  test('без описания не отправляет поле description', async () => {
    const { created } = stubMeetingTypesApi([])
    renderAdminPage()
    await section()

    fillForm({ id: 'intro-call', title: 'Знакомство', duration: '30 мин' })
    submit()

    await screen.findByText('Тип встречи создан')
    expect(created).toEqual([
      { id: 'intro-call', title: 'Знакомство', durationMinutes: 30 },
    ])
  })

  test('показывает ошибки у полей и сохраняет введённые значения', async () => {
    stubMeetingTypesApi([], () =>
      Response.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          fieldErrors: [
            { field: 'id', code: 'INVALID_FORMAT' },
            { field: 'title', code: 'TOO_LONG' },
            { field: 'description', code: 'TOO_LONG' },
            { field: 'durationMinutes', code: 'REQUIRED' },
          ],
        },
        { status: 400 },
      ),
    )
    renderAdminPage()
    await section()

    fillForm({ id: 'Intro_Call', title: 'Знакомство' })
    submit()

    const idInput =
      screen.getByLabelText<HTMLInputElement>('Идентификатор (id)')
    await screen.findByText('Название — не длиннее 80 символов')
    expect(idInput.getAttribute('aria-invalid')).toBe('true')
    expect(idInput.value).toBe('Intro_Call')
    screen.getByText(
      'Латиница, цифры и дефис, 3–40 символов, например intro-call',
    )
    screen.getByText('Описание — не длиннее 500 символов')
    screen.getByText('Выберите длительность')
    expect(screen.getByLabelText('Название').getAttribute('aria-invalid')).toBe(
      'true',
    )
    expect(screen.queryByText('Тип встречи создан')).toBeNull()
  })

  test('сочетание поля и кода без отдельного текста — «Проверьте значение поля»', async () => {
    stubMeetingTypesApi([], () =>
      Response.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          fieldErrors: [{ field: 'title', code: 'INVALID_FORMAT' }],
        },
        { status: 400 },
      ),
    )
    renderAdminPage()
    await section()

    fillForm({ id: 'intro-call', title: 'Знакомство', duration: '30 мин' })
    submit()

    await screen.findByText('Проверьте значение поля')
  })

  test('занятый id показывает ошибку у поля «Идентификатор (id)»', async () => {
    stubMeetingTypesApi(
      [{ id: 'intro-call', title: 'Знакомство', durationMinutes: 30 }],
      () =>
        Response.json(
          {
            code: 'MEETING_TYPE_ID_TAKEN',
            message: 'Meeting type "intro-call" already exists',
          },
          { status: 409 },
        ),
    )
    renderAdminPage()
    await section()

    fillForm({ id: 'intro-call', title: 'Ещё одно', duration: '1 ч' })
    submit()

    const error = await screen.findByText(
      'Тип встречи с таким идентификатором уже существует',
    )
    const idInput = screen.getByLabelText('Идентификатор (id)')
    expect(idInput.getAttribute('aria-invalid')).toBe('true')
    expect(idInput.getAttribute('aria-describedby')).toContain(error.id)
  })

  test('при сбое сервера сообщает, что отправить не удалось', async () => {
    stubMeetingTypesApi([], () => Response.json({}, { status: 500 }))
    renderAdminPage()
    await section()

    fillForm({ id: 'intro-call', title: 'Знакомство', duration: '30 мин' })
    submit()

    await screen.findByText('Не удалось отправить. Попробуйте ещё раз.')
  })

  test('блокирует кнопку на время отправки', async () => {
    let respond: ((response: Response) => void) | undefined
    stubFetch({
      '/api/bookings': () => Response.json([]),
      '/api/meeting-types': (request) =>
        request.method === 'POST'
          ? new Promise<Response>((resolve) => {
              respond = resolve
            })
          : Response.json([]),
    })
    renderAdminPage()
    await section()

    fillForm({ id: 'intro-call', title: 'Знакомство', duration: '30 мин' })
    submit()

    await vi.waitFor(() => {
      expect(respond).toBeDefined()
    })
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Создать' })
        .disabled,
    ).toBe(true)
    respond?.(
      Response.json(
        { id: 'intro-call', title: 'Знакомство', durationMinutes: 30 },
        { status: 201 },
      ),
    )
    await screen.findByText('Тип встречи создан')
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Создать' })
        .disabled,
    ).toBe(false)
  })

  test('в шапке нет ссылки на раздел владельца', async () => {
    stubMeetingTypesApi([])

    renderAdminPage()

    const header = within(await screen.findByRole('banner'))
    expect(
      header
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
        .filter((href) => href?.startsWith('/admin')),
    ).toEqual([])
  })
})

describe('раздел владельца: предстоящие бронирования', () => {
  const booking = (
    overrides: Partial<UpcomingBooking> &
      Pick<UpcomingBooking, 'id' | 'startsAt' | 'endsAt'>,
  ): UpcomingBooking => ({
    meetingTypeId: 'intro-call',
    meetingTypeTitle: 'Знакомство',
    guestName: 'Анна',
    guestEmail: 'anna@example.com',
    createdAt: '2026-11-20T15:00:00+01:00',
    ...overrides,
  })

  test('секция бронирований — перед типами встреч, часовой пояс в заголовке', async () => {
    stubMeetingTypesApi([])

    renderAdminPage()

    await bookingsSection()
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual(['Предстоящие бронирования', 'Типы встреч'])
    const header = within(
      screen.getByRole('heading', {
        level: 2,
        name: 'Предстоящие бронирования',
      }).parentElement!,
    )
    header.getByText('Europe/Warsaw')
  })

  test('без бронирований сообщает, что их нет', async () => {
    stubMeetingTypesApi([])

    renderAdminPage()

    ;(await bookingsSection()).getByText('Предстоящих бронирований нет')
  })

  test('группирует бронирования по дням в порядке ответа', async () => {
    stubMeetingTypesApi([], undefined, [
      booking({
        id: 'b1',
        startsAt: '2026-11-21T10:00:00+01:00',
        endsAt: '2026-11-21T11:00:00+01:00',
        meetingTypeId: 'consultation',
        meetingTypeTitle: 'Консультация',
        guestName: 'Борис',
        guestEmail: 'boris@example.com',
        createdAt: '2026-11-19T09:05:00+01:00',
      }),
      booking({
        id: 'b2',
        startsAt: '2026-11-21T11:00:00+01:00',
        endsAt: '2026-11-21T11:30:00+01:00',
      }),
      // Момент в UTC показывается по Варшаве: 23 ноября, 09:30–10:00.
      booking({
        id: 'b3',
        startsAt: '2026-11-23T08:30:00Z',
        endsAt: '2026-11-23T09:00:00Z',
        guestName: 'Вера',
        guestEmail: 'vera@example.com',
      }),
    ])

    renderAdminPage()

    const bookings = await bookingsSection()
    const days = bookings.getAllByRole('heading', { level: 3 })
    expect(days.map((day) => day.textContent)).toEqual([
      'Суббота, 21 ноября',
      'Понедельник, 23 ноября',
    ])
    const itemsOf = (day: HTMLElement) =>
      within(day.closest('li')!)
        .getAllByRole('listitem')
        .map((item) => within(item))
    const [saturday, monday] = days.map(itemsOf)
    expect(saturday).toHaveLength(2)
    expect(monday).toHaveLength(1)
    const [first, second] = saturday
    first.getByText('10:00–11:00')
    first.getByText('Консультация')
    first.getByText('Борис')
    first.getByText('boris@example.com')
    first.getByText('Создано: 19.11.2026, 09:05')
    second.getByText('11:00–11:30')
    second.getByText('Знакомство')
    const [third] = monday
    third.getByText('09:30–10:00')
    third.getByText('Вера')
    third.getByText('vera@example.com')
    third.getByText('Создано: 20.11.2026, 15:00')
  })
})
