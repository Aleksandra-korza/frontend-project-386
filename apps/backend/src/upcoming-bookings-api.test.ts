import { Temporal } from 'temporal-polyfill'
import { afterEach, describe, expect, test } from 'vitest'
import type { Booking } from './generated/index.ts'
import { createStore } from './store.ts'
import { startTestServer } from './testing/http.ts'
import { sampleMeetingTypes } from './testing/meeting-types.ts'

// Предстоящие бронирования владельца через настоящий HTTP
// (docs/specs/booking.md §5, §6.2; FR-20, BR-24) с фиксированными часами:
// «сейчас» — 2026-11-20 15:00 по Варшаве.
// Типы: intro-call «Знакомство» — 30 минут, consultation «Консультация» — 90 минут.
const now = () => Temporal.Instant.from('2026-11-20T14:00:00Z')

let server: Awaited<ReturnType<typeof startTestServer>> | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

const start = (bookings: Booking[]) =>
  startTestServer({
    store: createStore({ meetingTypes: sampleMeetingTypes, bookings }),
    now,
  })

const listUpcoming = async () => {
  const response = await server!.request('/api/bookings')
  expect(response.status).toBe(200)
  return (await response.json()) as (Booking & { meetingTypeTitle: string })[]
}

const booking = (
  id: string,
  meetingTypeId: string,
  startsAt: string,
  endsAt: string,
): Booking => ({
  id,
  meetingTypeId,
  startsAt,
  endsAt,
  guestName: `Гость ${id}`,
  guestEmail: `${id}@example.com`,
  createdAt: '2026-11-10T12:00:00+01:00',
})

describe('GET /api/bookings', () => {
  test('без бронирований — пустой список', async () => {
    server = await start([])

    expect(await listUpcoming()).toEqual([])
  })

  test('бронирования всех типов по возрастанию начала, с названием типа', async () => {
    server = await start([
      booking(
        'later',
        'consultation',
        '2026-11-25T09:00:00+01:00',
        '2026-11-25T10:30:00+01:00',
      ),
      booking(
        'sooner',
        'intro-call',
        '2026-11-23T10:00:00+01:00',
        '2026-11-23T10:30:00+01:00',
      ),
      booking(
        'between',
        'intro-call',
        '2026-11-23T10:30:00+01:00',
        '2026-11-23T11:00:00+01:00',
      ),
    ])

    expect(await listUpcoming()).toEqual([
      {
        id: 'sooner',
        meetingTypeId: 'intro-call',
        meetingTypeTitle: 'Знакомство',
        startsAt: '2026-11-23T10:00:00+01:00',
        endsAt: '2026-11-23T10:30:00+01:00',
        guestName: 'Гость sooner',
        guestEmail: 'sooner@example.com',
        createdAt: '2026-11-10T12:00:00+01:00',
      },
      {
        id: 'between',
        meetingTypeId: 'intro-call',
        meetingTypeTitle: 'Знакомство',
        startsAt: '2026-11-23T10:30:00+01:00',
        endsAt: '2026-11-23T11:00:00+01:00',
        guestName: 'Гость between',
        guestEmail: 'between@example.com',
        createdAt: '2026-11-10T12:00:00+01:00',
      },
      {
        id: 'later',
        meetingTypeId: 'consultation',
        meetingTypeTitle: 'Консультация',
        startsAt: '2026-11-25T09:00:00+01:00',
        endsAt: '2026-11-25T10:30:00+01:00',
        guestName: 'Гость later',
        guestEmail: 'later@example.com',
        createdAt: '2026-11-10T12:00:00+01:00',
      },
    ])
  })

  test('только встречи, начало которых строго позже текущего момента (BR-24)', async () => {
    server = await start([
      booking(
        'past',
        'consultation',
        '2026-11-19T10:00:00+01:00',
        '2026-11-19T11:30:00+01:00',
      ),
      booking(
        'in-progress',
        'intro-call',
        '2026-11-20T14:45:00+01:00',
        '2026-11-20T15:15:00+01:00',
      ),
      booking(
        'starts-now',
        'intro-call',
        '2026-11-20T15:00:00+01:00',
        '2026-11-20T15:30:00+01:00',
      ),
      booking(
        'next-minute',
        'intro-call',
        '2026-11-20T15:01:00+01:00',
        '2026-11-20T15:31:00+01:00',
      ),
    ])

    expect((await listUpcoming()).map(({ id }) => id)).toEqual(['next-minute'])
  })

  test('сравнивает моменты, а не строки: смещение UTC в хранилище', async () => {
    server = await start([
      booking(
        'utc-past',
        'intro-call',
        '2026-11-20T13:30:00Z',
        '2026-11-20T14:00:00Z',
      ),
      booking(
        'utc-future',
        'intro-call',
        '2026-11-20T14:30:00Z',
        '2026-11-20T15:00:00Z',
      ),
    ])

    expect((await listUpcoming()).map(({ id }) => id)).toEqual(['utc-future'])
  })

  test('созданное через API бронирование появляется в списке', async () => {
    server = await start([])

    const created = await server.request('/api/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        meetingTypeId: 'consultation',
        startsAt: '2026-11-23T10:00:00+01:00',
        guestName: 'Анна',
        guestEmail: 'anna@example.com',
      }),
    })
    expect(created.status).toBe(201)

    expect(await listUpcoming()).toEqual([
      {
        ...((await created.json()) as Booking),
        meetingTypeTitle: 'Консультация',
      },
    ])
  })
})

test('бронирование неизвестного типа нарушает инвариант хранилища', () => {
  // Типы встреч не удаляются: у каждого бронирования есть тип с названием.
  expect(() =>
    createStore({
      meetingTypes: sampleMeetingTypes,
      bookings: [
        booking(
          'orphan',
          'deleted-type',
          '2026-11-23T10:00:00+01:00',
          '2026-11-23T10:30:00+01:00',
        ),
      ],
    }),
  ).toThrow('deleted-type')
})
