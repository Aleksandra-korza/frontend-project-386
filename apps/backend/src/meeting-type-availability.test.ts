import { Temporal } from 'temporal-polyfill'
import { afterEach, describe, expect, test } from 'vitest'
import { createStore } from './store.ts'
import { startTestServer } from './testing/http.ts'
import { sampleMeetingTypes } from './testing/meeting-types.ts'

// Тип встречи и доступность времени через настоящий HTTP (docs/specs/booking.md §5, §7)
// с фиксированными часами: «сейчас» — 2026-11-20 15:00 по Варшаве.
const now = () => Temporal.Instant.from('2026-11-20T14:00:00Z')

let server: Awaited<ReturnType<typeof startTestServer>> | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

const start = () =>
  startTestServer({
    store: createStore({ meetingTypes: sampleMeetingTypes }),
    now,
  })

describe('GET /api/meeting-types/{id}', () => {
  test('возвращает тип встречи', async () => {
    server = await start()

    const response = await server.request('/api/meeting-types/consultation')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      id: 'consultation',
      title: 'Консультация',
      description: 'Разбор вашего вопроса',
      durationMinutes: 90,
    })
  })

  test('неизвестный тип — 404 MEETING_TYPE_NOT_FOUND', async () => {
    server = await start()

    const response = await server.request('/api/meeting-types/unknown')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      code: 'MEETING_TYPE_NOT_FOUND',
      message: expect.any(String) as string,
    })
  })
})

describe('GET /api/meeting-types/{id}/availability', () => {
  test('отдаёт окно и все слоты типа со смещением Варшавы; без бронирований все свободны', async () => {
    server = await start()

    const response = await server.request(
      '/api/meeting-types/consultation/availability',
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      timeZone: string
      window: { from: string; to: string }
      days: {
        date: string
        slots: { startsAt: string; endsAt: string; available: boolean }[]
      }[]
    }
    expect(body.timeZone).toBe('Europe/Warsaw')
    expect(body.window).toEqual({ from: '2026-11-21', to: '2026-12-04' })
    expect(body.days).toHaveLength(14)
    expect(body.days[0]?.date).toBe('2026-11-21')
    expect(body.days[13]?.date).toBe('2026-12-04')
    // 90 минут: последнее начало 16:30 (BR-11) — 16 слотов в день.
    expect(body.days[0]?.slots).toHaveLength(16)
    expect(body.days[0]?.slots[0]).toEqual({
      startsAt: '2026-11-21T09:00:00+01:00',
      endsAt: '2026-11-21T10:30:00+01:00',
      available: true,
    })
    expect(body.days[0]?.slots.at(-1)).toEqual({
      startsAt: '2026-11-21T16:30:00+01:00',
      endsAt: '2026-11-21T18:00:00+01:00',
      available: true,
    })
    expect(
      body.days.every((day) => day.slots.every((slot) => slot.available)),
    ).toBe(true)
  })

  test('окно сдвигается вместе с часами', async () => {
    server = await startTestServer({
      store: createStore({ meetingTypes: sampleMeetingTypes }),
      now: () => Temporal.Instant.from('2026-11-25T08:00:00Z'),
    })

    const response = await server.request(
      '/api/meeting-types/intro-call/availability',
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      window: { from: string; to: string }
    }
    expect(body.window).toEqual({ from: '2026-11-26', to: '2026-12-09' })
  })

  test('неизвестный тип — 404 MEETING_TYPE_NOT_FOUND', async () => {
    server = await start()

    const response = await server.request(
      '/api/meeting-types/unknown/availability',
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      code: 'MEETING_TYPE_NOT_FOUND',
      message: expect.any(String) as string,
    })
  })
})
