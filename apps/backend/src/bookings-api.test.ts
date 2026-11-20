import { Temporal } from 'temporal-polyfill'
import { afterEach, describe, expect, test } from 'vitest'
import type { Booking } from './generated/index.ts'
import { createStore } from './store.ts'
import { startTestServer } from './testing/http.ts'
import { sampleMeetingTypes } from './testing/meeting-types.ts'

// Создание бронирования через настоящий HTTP (docs/specs/booking.md §4, §5, §7)
// с фиксированными часами: «сейчас» — 2026-11-20 15:00 по Варшаве,
// окно бронирования — 2026-11-21…2026-12-04.
// Типы: intro-call — 30 минут, consultation — 90 минут.
const now = () => Temporal.Instant.from('2026-11-20T14:00:00Z')

let server: Awaited<ReturnType<typeof startTestServer>> | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

const start = (bookings: Booking[] = []) =>
  startTestServer({
    store: createStore({ meetingTypes: sampleMeetingTypes, bookings }),
    now,
  })

type ErrorBody = {
  code: string
  message: string
  fieldErrors?: { field: string; code: string }[]
}

const guest = { guestName: 'Анна', guestEmail: 'anna@example.com' }

const postBooking = (body: unknown) =>
  server!.request('/api/bookings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const book = (meetingTypeId: string, startsAt: string) =>
  postBooking({ meetingTypeId, startsAt, ...guest })

const existing: Booking = {
  id: 'existing',
  meetingTypeId: 'consultation',
  startsAt: '2026-11-23T10:00:00+01:00',
  endsAt: '2026-11-23T11:30:00+01:00',
  guestName: 'Борис',
  guestEmail: 'boris@example.com',
  createdAt: '2026-11-19T12:00:00+01:00',
}

describe('POST /api/bookings', () => {
  test('создаёт бронирование: 201, конец вычисляет сервер, имя обрезано', async () => {
    server = await start()

    const response = await postBooking({
      meetingTypeId: 'intro-call',
      startsAt: '2026-11-23T10:00:00+01:00',
      guestName: '  Анна  ',
      guestEmail: 'anna@example.com',
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      id: expect.any(String) as string,
      meetingTypeId: 'intro-call',
      startsAt: '2026-11-23T10:00:00+01:00',
      endsAt: '2026-11-23T10:30:00+01:00',
      guestName: 'Анна',
      guestEmail: 'anna@example.com',
      createdAt: '2026-11-20T15:00:00+01:00',
    })
  })

  test('startsAt с другим смещением — тот же момент; в ответе смещение Варшавы', async () => {
    server = await start()

    const response = await book('consultation', '2026-11-23T08:00:00Z')

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      startsAt: '2026-11-23T09:00:00+01:00',
      endsAt: '2026-11-23T10:30:00+01:00',
    })
  })

  test('тот же email можно использовать повторно (BR-22)', async () => {
    server = await start()

    expect((await book('intro-call', '2026-11-23T10:00:00+01:00')).status).toBe(
      201,
    )
    expect((await book('intro-call', '2026-11-24T10:00:00+01:00')).status).toBe(
      201,
    )
  })

  test('неизвестный тип — 404 MEETING_TYPE_NOT_FOUND раньше ошибок полей', async () => {
    server = await start()

    const response = await postBooking({
      meetingTypeId: 'unknown',
      startsAt: 'завтра',
      guestName: '',
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      code: 'MEETING_TYPE_NOT_FOUND',
      message: expect.any(String) as string,
    })
  })

  test('пустое тело — 400 VALIDATION_ERROR: все поля обязательны', async () => {
    server = await start()

    const response = await postBooking({})

    expect(response.status).toBe(400)
    const body = (await response.json()) as ErrorBody
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.fieldErrors).toEqual(
      expect.arrayContaining([
        { field: 'meetingTypeId', code: 'REQUIRED' },
        { field: 'startsAt', code: 'REQUIRED' },
        { field: 'guestName', code: 'REQUIRED' },
        { field: 'guestEmail', code: 'REQUIRED' },
      ]),
    )
    expect(body.fieldErrors).toHaveLength(4)
  })

  test.each([
    ['имя из пробелов', { guestName: '   ' }, 'guestName', 'REQUIRED'],
    ['имя null', { guestName: null }, 'guestName', 'REQUIRED'],
    [
      'имя длиннее 100 символов после обрезки',
      { guestName: ` ${'я'.repeat(101)} ` },
      'guestName',
      'TOO_LONG',
    ],
    ['email не email', { guestEmail: 'anna' }, 'guestEmail', 'INVALID_FORMAT'],
    [
      'email длиннее 254 символов',
      // Корректный формат (метки домена ≤ 63 символов), 259 символов.
      {
        guestEmail: `${'a'.repeat(64)}@${`${'b'.repeat(60)}.`.repeat(3)}example.com`,
      },
      'guestEmail',
      'TOO_LONG',
    ],
    ['имя не строка', { guestName: 42 }, 'guestName', 'INVALID_FORMAT'],
  ])('%s — 400, ошибка поля', async (_, override, field, code) => {
    server = await start()

    const response = await postBooking({
      meetingTypeId: 'intro-call',
      startsAt: '2026-11-23T10:00:00+01:00',
      ...guest,
      ...override,
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      code: 'VALIDATION_ERROR',
      message: expect.any(String) as string,
      fieldErrors: [{ field, code }],
    })
  })

  test('имя ровно 100 символов допустимо', async () => {
    server = await start()

    const response = await postBooking({
      meetingTypeId: 'intro-call',
      startsAt: '2026-11-23T10:00:00+01:00',
      ...guest,
      guestName: 'я'.repeat(100),
    })

    expect(response.status).toBe(201)
  })

  test.each([
    ['без смещения', 'intro-call', '2026-11-23T10:00:00', 'INVALID_FORMAT'],
    ['не дата', 'intro-call', 'завтра в 10', 'INVALID_FORMAT'],
    [
      'не точка сетки',
      'intro-call',
      '2026-11-23T10:15:00+01:00',
      'INVALID_SLOT',
    ],
    ['до 09:00', 'intro-call', '2026-11-23T08:30:00+01:00', 'INVALID_SLOT'],
    [
      'встреча выходит за 18:00',
      'consultation',
      '2026-11-23T17:00:00+01:00',
      'INVALID_SLOT',
    ],
    ['сегодня', 'intro-call', '2026-11-20T16:00:00+01:00', 'INVALID_SLOT'],
    ['в прошлом', 'intro-call', '2026-11-19T10:00:00+01:00', 'INVALID_SLOT'],
    ['после окна', 'intro-call', '2026-12-05T10:00:00+01:00', 'INVALID_SLOT'],
  ])('startsAt %s — 400 %s', async (_, meetingTypeId, startsAt, code) => {
    server = await start()

    const response = await book(meetingTypeId, startsAt)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      code: 'VALIDATION_ERROR',
      message: expect.any(String) as string,
      fieldErrors: [{ field: 'startsAt', code }],
    })
  })

  test('ошибки гостя и недопустимый слот — в одном ответе', async () => {
    server = await start()

    const response = await postBooking({
      meetingTypeId: 'intro-call',
      startsAt: '2026-11-23T10:15:00+01:00',
      guestName: '',
      guestEmail: 'anna',
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as ErrorBody
    expect(body.fieldErrors).toEqual(
      expect.arrayContaining([
        { field: 'guestName', code: 'REQUIRED' },
        { field: 'guestEmail', code: 'INVALID_FORMAT' },
        { field: 'startsAt', code: 'INVALID_SLOT' },
      ]),
    )
    expect(body.fieldErrors).toHaveLength(3)
  })

  test('недопустимый слот на занятое время — 400, а не 409', async () => {
    server = await start([existing])

    const response = await book('intro-call', '2026-11-23T10:15:00+01:00')

    expect(response.status).toBe(400)
  })

  test('неразбираемое тело — 400 VALIDATION_ERROR', async () => {
    server = await start()

    const response = await postBooking('{')

    expect(response.status).toBe(400)
    expect(((await response.json()) as ErrorBody).code).toBe('VALIDATION_ERROR')
  })
})

describe('пересечения (BR-14…BR-17)', () => {
  test('то же время ещё раз — 409 SLOT_TAKEN без данных чужого бронирования', async () => {
    server = await start()
    expect((await book('intro-call', '2026-11-23T10:00:00+01:00')).status).toBe(
      201,
    )

    const response = await postBooking({
      meetingTypeId: 'intro-call',
      startsAt: '2026-11-23T10:00:00+01:00',
      guestName: 'Вера',
      guestEmail: 'vera@example.com',
    })

    expect(response.status).toBe(409)
    const body = (await response.json()) as ErrorBody
    expect(body).toEqual({
      code: 'SLOT_TAKEN',
      message: expect.any(String) as string,
    })
    expect(body.message).not.toMatch(/Анна|anna@example\.com|intro-call/)
  })

  test.each([
    ['10:00 того же начала', '2026-11-23T10:00:00+01:00'],
    ['10:30 внутри', '2026-11-23T10:30:00+01:00'],
    ['11:00 до конца', '2026-11-23T11:00:00+01:00'],
  ])(
    'бронирование другого типа 10:00–11:30, intro-call в %s — 409',
    async (_, startsAt) => {
      server = await start([existing])

      const response = await book('intro-call', startsAt)

      expect(response.status).toBe(409)
      expect(((await response.json()) as ErrorBody).code).toBe('SLOT_TAKEN')
    },
  )

  test('консультация 09:00–10:30 пересекает intro-call 10:00–10:30 — 409', async () => {
    server = await start()
    expect((await book('intro-call', '2026-11-23T10:00:00+01:00')).status).toBe(
      201,
    )

    const response = await book('consultation', '2026-11-23T09:00:00+01:00')

    expect(response.status).toBe(409)
  })

  test.each([
    ['11:30 сразу после', '2026-11-23T11:30:00+01:00'],
    ['09:30 вплотную до', '2026-11-23T09:30:00+01:00'],
  ])('примыкание допустимо: intro-call в %s — 201', async (_, startsAt) => {
    server = await start([existing])

    const response = await book('intro-call', startsAt)

    expect(response.status).toBe(201)
  })
})

describe('доступность учитывает бронирования любых типов', () => {
  type Availability = {
    days: {
      date: string
      slots: { startsAt: string; available: boolean }[]
    }[]
  }

  const busyStarts = async (meetingTypeId: string, date: string) => {
    const response = await server!.request(
      `/api/meeting-types/${meetingTypeId}/availability`,
    )
    const body = (await response.json()) as Availability
    return (
      body.days
        .find((day) => day.date === date)
        ?.slots.filter((slot) => !slot.available)
        .map((slot) => slot.startsAt.slice(11, 16)) ?? []
    )
  }

  test('после бронирования intro-call 10:00–10:30 заняты пересекающиеся слоты обоих типов', async () => {
    server = await start()
    expect((await book('intro-call', '2026-11-23T10:00:00+01:00')).status).toBe(
      201,
    )

    expect(await busyStarts('intro-call', '2026-11-23')).toEqual(['10:00'])
    // 90 минут: 09:00–10:30 и 09:30–11:00 пересекают 10:00–10:30, 08:30 нет в сетке.
    expect(await busyStarts('consultation', '2026-11-23')).toEqual([
      '09:00',
      '09:30',
      '10:00',
    ])
    expect(await busyStarts('consultation', '2026-11-24')).toEqual([])
  })
})
