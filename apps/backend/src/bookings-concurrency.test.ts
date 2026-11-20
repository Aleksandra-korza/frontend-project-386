import { Temporal } from 'temporal-polyfill'
import { afterEach, describe, expect, test } from 'vitest'
import { createStore, type Store } from './store.ts'
import { startTestServer } from './testing/http.ts'

// Одновременные запросы на бронирование через настоящий HTTP (NFR-02, BR-18,
// ADR-0003 «Тестовые инварианты»): ровно одно бронирование, остальные — 409,
// в хранилище нет пересекающихся интервалов.
const now = () => Temporal.Instant.from('2026-11-20T14:00:00Z')

const meetingTypes = [
  { id: 'hour', title: 'Час', durationMinutes: 60 },
  { id: 'half-hour', title: 'Полчаса', durationMinutes: 30 },
  { id: 'two-hours', title: 'Два часа', durationMinutes: 120 },
]

let server: Awaited<ReturnType<typeof startTestServer>> | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

async function startWithStore() {
  const store = createStore({ meetingTypes })
  server = await startTestServer({ store, now })
  return store
}

const book = (meetingTypeId: string, startsAt: string, index: number) =>
  server!.request('/api/bookings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      meetingTypeId,
      startsAt,
      guestName: `Гость ${String(index)}`,
      guestEmail: `guest${String(index)}@example.com`,
    }),
  })

// Независимо от проверяемого правила: отсортированные интервалы идут друг за другом.
function expectNoOverlaps(store: Store) {
  const intervals = store
    .listBookedIntervals()
    .map(({ startsAt, endsAt }) => [
      startsAt.epochMilliseconds,
      endsAt.epochMilliseconds,
    ])
    .sort(([a = 0], [b = 0]) => a - b)
  for (const [index, [start = 0]] of intervals.entries()) {
    expect(start).toBeGreaterThanOrEqual(intervals[index - 1]?.[1] ?? start)
  }
}

describe('одновременные запросы на бронирование', () => {
  test('10 одинаковых запросов: одно бронирование, 9 конфликтов', async () => {
    const store = await startWithStore()

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        book('hour', '2026-11-23T10:00:00+01:00', index),
      ),
    )

    const statuses = responses.map((response) => response.status)
    expect(statuses.filter((status) => status === 201)).toHaveLength(1)
    expect(statuses.filter((status) => status === 409)).toHaveLength(9)
    expect(store.listBookedIntervals()).toHaveLength(1)
    expectNoOverlaps(store)
  })

  test('пересекающиеся запросы разных типов: одно бронирование, остальные — конфликт', async () => {
    const store = await startWithStore()
    // Все интервалы содержат 10:30–11:00: 10:00–11:00, 10:30–11:00, 09:00–11:00, 10:30–12:30.
    const requests = [
      ['hour', '2026-11-23T10:00:00+01:00'],
      ['half-hour', '2026-11-23T10:30:00+01:00'],
      ['two-hours', '2026-11-23T09:00:00+01:00'],
      ['two-hours', '2026-11-23T10:30:00+01:00'],
    ] as const

    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, index) => {
        const [meetingTypeId, startsAt] = requests[index % requests.length]
        return book(meetingTypeId, startsAt, index)
      }),
    )

    const statuses = responses.map((response) => response.status)
    expect(statuses.filter((status) => status === 201)).toHaveLength(1)
    expect(statuses.filter((status) => status === 409)).toHaveLength(11)
    expect(store.listBookedIntervals()).toHaveLength(1)
    expectNoOverlaps(store)
  })
})
