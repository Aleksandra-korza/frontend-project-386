import { Temporal } from 'temporal-polyfill'
import { describe, expect, test } from 'vitest'
import { normalizeBookingInput, overlaps } from './bookings.ts'

// Пересечение и примыкание интервалов (docs/specs/booking.md §4, BR-14…BR-17).
const interval = (start: string, end: string) => ({
  startsAt: Temporal.Instant.from(`2026-11-23T${start}:00+01:00`),
  endsAt: Temporal.Instant.from(`2026-11-23T${end}:00+01:00`),
})

describe('пересечение с бронированием 10:00–11:00', () => {
  const booked = interval('10:00', '11:00')

  test.each([
    ['10:30–11:00', interval('10:30', '11:00')],
    ['10:00–10:30', interval('10:00', '10:30')],
    ['10:00–11:00', interval('10:00', '11:00')],
    ['09:30–10:30', interval('09:30', '10:30')],
    ['09:00–12:00 (охватывает)', interval('09:00', '12:00')],
    ['10:15–10:45 (внутри)', interval('10:15', '10:45')],
  ])('%s пересекается', (_, candidate) => {
    expect(overlaps(booked, candidate)).toBe(true)
    expect(overlaps(candidate, booked)).toBe(true)
  })

  test.each([
    ['11:00–11:30 (примыкает после)', interval('11:00', '11:30')],
    ['09:00–10:00 (примыкает до)', interval('09:00', '10:00')],
    ['12:00–13:00', interval('12:00', '13:00')],
  ])('%s не пересекается', (_, candidate) => {
    expect(overlaps(booked, candidate)).toBe(false)
    expect(overlaps(candidate, booked)).toBe(false)
  })

  test('сравниваются абсолютные моменты, а не запись со смещением', () => {
    const utc = {
      startsAt: Temporal.Instant.from('2026-11-23T09:30:00Z'),
      endsAt: Temporal.Instant.from('2026-11-23T10:00:00Z'),
    }

    // 09:30Z = 10:30 по Варшаве.
    expect(overlaps(booked, utc)).toBe(true)
  })
})

// Поля гостя до проверки схемой (docs/specs/booking.md §2, BR-20, BR-21).
describe('данные гостя', () => {
  test('имя обрезается по краям, email — нет', () => {
    expect(
      normalizeBookingInput({
        meetingTypeId: 'intro-call',
        startsAt: '2026-11-23T10:00:00+01:00',
        guestName: '  Анна  ',
        guestEmail: 'anna@example.com',
      }),
    ).toEqual({
      meetingTypeId: 'intro-call',
      startsAt: '2026-11-23T10:00:00+01:00',
      guestName: 'Анна',
      guestEmail: 'anna@example.com',
    })
  })

  test('null — как отсутствие поля', () => {
    expect(
      normalizeBookingInput({ guestName: null, guestEmail: 'a@b.cz' }),
    ).toEqual({ guestEmail: 'a@b.cz' })
  })

  test('тело не объект — без изменений', () => {
    expect(normalizeBookingInput('text')).toBe('text')
    expect(normalizeBookingInput(null)).toBe(null)
  })
})
