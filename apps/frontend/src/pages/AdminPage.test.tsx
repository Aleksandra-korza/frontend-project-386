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

// «Раздел владельца» /admin, секция «Типы встреч» (docs/specs/booking.md §6.2, §6.3).
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

// Backend в памяти теста: GET отдаёт список, POST отвечает переданной функцией.
function stubMeetingTypesApi(
  initial: MeetingType[],
  onCreate: (body: Record<string, unknown>) => Response = (body) =>
    Response.json(body, { status: 201 }),
) {
  const meetingTypes = [...initial]
  const created: Record<string, unknown>[] = []
  stubFetch({
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

const section = async () =>
  within(
    (
      await screen.findByRole('heading', { level: 2, name: 'Типы встреч' })
    ).closest('section')!,
  )

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
