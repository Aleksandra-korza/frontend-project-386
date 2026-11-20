import { Temporal } from 'temporal-polyfill'
import { describe, expect, test } from 'vitest'
import { buildSchedule, findSlot, type ScheduleDay } from './availability.ts'

// Окно бронирования и сетка слотов (docs/specs/booking.md §3, ADR-0004)
// с фиксированными часами: «сейчас» — 2026-11-20 15:00 по Варшаве.
const now = Temporal.Instant.from('2026-11-20T14:00:00Z')

describe('окно бронирования', () => {
  test('14 дней, начиная с завтрашнего по Варшаве', () => {
    const schedule = buildSchedule(30, now)

    expect(schedule.window).toEqual({ from: '2026-11-21', to: '2026-12-04' })
    expect(schedule.days.map((day) => day.date)).toEqual([
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
    ])
  })
})

const startsOf = (day: ScheduleDay | undefined) =>
  (day?.slots ?? []).map((slot) =>
    slot.startsAt.toString({ timeZoneName: 'never' }),
  )

describe('сетка слотов', () => {
  test('слоты 30 минут: 09:00…17:30 с шагом 30 минут, конец — начало + длительность', () => {
    const [day] = buildSchedule(30, now).days

    expect(startsOf(day)).toEqual([
      '2026-11-21T09:00:00+01:00',
      '2026-11-21T09:30:00+01:00',
      '2026-11-21T10:00:00+01:00',
      '2026-11-21T10:30:00+01:00',
      '2026-11-21T11:00:00+01:00',
      '2026-11-21T11:30:00+01:00',
      '2026-11-21T12:00:00+01:00',
      '2026-11-21T12:30:00+01:00',
      '2026-11-21T13:00:00+01:00',
      '2026-11-21T13:30:00+01:00',
      '2026-11-21T14:00:00+01:00',
      '2026-11-21T14:30:00+01:00',
      '2026-11-21T15:00:00+01:00',
      '2026-11-21T15:30:00+01:00',
      '2026-11-21T16:00:00+01:00',
      '2026-11-21T16:30:00+01:00',
      '2026-11-21T17:00:00+01:00',
      '2026-11-21T17:30:00+01:00',
    ])
    expect(day?.slots[0]?.endsAt.toString({ timeZoneName: 'never' })).toBe(
      '2026-11-21T09:30:00+01:00',
    )
  })

  test.each([
    { durationMinutes: 15, count: 18, last: '17:30', lastEnd: '17:45' },
    { durationMinutes: 60, count: 17, last: '17:00', lastEnd: '18:00' },
    { durationMinutes: 90, count: 16, last: '16:30', lastEnd: '18:00' },
    { durationMinutes: 480, count: 3, last: '10:00', lastEnd: '18:00' },
  ])(
    'последнее начало для $durationMinutes мин — $last (BR-11)',
    ({ durationMinutes, count, last, lastEnd }) => {
      const [day] = buildSchedule(durationMinutes, now).days
      const lastSlot = day?.slots.at(-1)

      expect(day?.slots).toHaveLength(count)
      expect(lastSlot?.startsAt.toPlainTime().toString()).toBe(`${last}:00`)
      expect(lastSlot?.endsAt.toPlainTime().toString()).toBe(`${lastEnd}:00`)
    },
  )

  test('у каждого дня окна одна и та же местная сетка', () => {
    const { days } = buildSchedule(480, now)

    expect(
      days.map((day) =>
        day.slots.map((slot) => slot.startsAt.toPlainTime().toString()),
      ),
    ).toEqual(days.map(() => ['09:00:00', '09:30:00', '10:00:00']))
  })
})

describe('переход на летнее и зимнее время', () => {
  test('2026-03-29: сетка та же, смещение до перехода +01:00, в день перехода +02:00', () => {
    const { days } = buildSchedule(
      480,
      Temporal.Instant.from('2026-03-27T12:00:00Z'),
    )

    expect(days.slice(0, 2).map(startsOf)).toEqual([
      [
        '2026-03-28T09:00:00+01:00',
        '2026-03-28T09:30:00+01:00',
        '2026-03-28T10:00:00+01:00',
      ],
      [
        '2026-03-29T09:00:00+02:00',
        '2026-03-29T09:30:00+02:00',
        '2026-03-29T10:00:00+02:00',
      ],
    ])
    expect(days[1]?.slots[2]?.endsAt.toString({ timeZoneName: 'never' })).toBe(
      '2026-03-29T18:00:00+02:00',
    )
  })

  test('2026-10-25: сетка та же, смещение до перехода +02:00, в день перехода +01:00', () => {
    const { days } = buildSchedule(
      480,
      Temporal.Instant.from('2026-10-23T12:00:00Z'),
    )

    expect(days.slice(0, 2).map(startsOf)).toEqual([
      [
        '2026-10-24T09:00:00+02:00',
        '2026-10-24T09:30:00+02:00',
        '2026-10-24T10:00:00+02:00',
      ],
      [
        '2026-10-25T09:00:00+01:00',
        '2026-10-25T09:30:00+01:00',
        '2026-10-25T10:00:00+01:00',
      ],
    ])
  })
})

describe('«сегодня» по Варшаве', () => {
  test('после полуночи по Варшаве окно начинается с послезавтра по UTC-дате', () => {
    // 2026-11-20T23:30Z — уже 2026-11-21 00:30 в Варшаве.
    const { window } = buildSchedule(
      30,
      Temporal.Instant.from('2026-11-20T23:30:00Z'),
    )

    expect(window).toEqual({ from: '2026-11-22', to: '2026-12-05' })
  })
})

describe('поиск слота по startsAt', () => {
  test('находит слот, если момент совпадает с началом слота в окне, в любом смещении', () => {
    const slot = findSlot(
      60,
      now,
      Temporal.Instant.from('2026-11-21T09:00:00Z'),
    )

    expect(slot?.startsAt.toString({ timeZoneName: 'never' })).toBe(
      '2026-11-21T10:00:00+01:00',
    )
    expect(slot?.endsAt.toString({ timeZoneName: 'never' })).toBe(
      '2026-11-21T11:00:00+01:00',
    )
  })

  test.each([
    ['не точка сетки', '2026-11-21T10:15:00+01:00'],
    ['встреча выходит за 18:00', '2026-11-21T17:30:00+01:00'],
    ['раньше 09:00', '2026-11-21T08:30:00+01:00'],
    ['сегодня', '2026-11-20T16:00:00+01:00'],
    ['прошлое', '2026-11-19T10:00:00+01:00'],
    ['после окна', '2026-12-05T10:00:00+01:00'],
  ])('не находит слот: %s', (_, startsAt) => {
    expect(findSlot(60, now, Temporal.Instant.from(startsAt))).toBeUndefined()
  })

  test('последний день окна допустим', () => {
    expect(
      findSlot(60, now, Temporal.Instant.from('2026-12-04T17:00:00+01:00')),
    ).toBeDefined()
  })
})
