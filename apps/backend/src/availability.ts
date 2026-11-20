import { Temporal } from 'temporal-polyfill'
import type { MeetingTypeAvailability } from './generated/index.ts'

// Окно бронирования и сетка слотов (docs/specs/booking.md §3, ADR-0004).
// Одна функция для выдачи доступности и для проверки startsAt при бронировании.

/** Часовой пояс сервиса (BR-03). */
export const TIME_ZONE = 'Europe/Warsaw' as const

/** Окно бронирования: 14 дней, начиная с завтрашнего (BR-01). */
const WINDOW_DAYS = 14

/** Местный день `YYYY-MM-DD` и его слоты. */
export type ScheduleDay = { date: string; slots: Slot[] }

/** Слот: интервал встречи выбранного типа в местном времени Варшавы. */
export type Slot = {
  startsAt: Temporal.ZonedDateTime
  endsAt: Temporal.ZonedDateTime
}

export type Schedule = {
  window: { from: string; to: string }
  days: ScheduleDay[]
}

/** Окно бронирования и все слоты типа длительностью `durationMinutes` на момент `now`. */
export function buildSchedule(
  durationMinutes: number,
  now: Temporal.Instant,
): Schedule {
  const today = now.toZonedDateTimeISO(TIME_ZONE).toPlainDate()
  const dates = Array.from({ length: WINDOW_DAYS }, (_, index) =>
    today.add({ days: index + 1 }),
  )

  return {
    window: {
      from: today.add({ days: 1 }).toString(),
      to: today.add({ days: WINDOW_DAYS }).toString(),
    },
    days: dates.map((date) => ({
      date: date.toString(),
      slots: slotsOfDay(date, durationMinutes),
    })),
  }
}

/** Время слота в API: ISO 8601 со смещением Варшавы, без имени зоны. */
const toApiDateTime = (value: Temporal.ZonedDateTime) =>
  value.toString({ timeZoneName: 'never' })

/** Ответ getMeetingTypeAvailability. Бронирований пока нет — все слоты свободны. */
export function meetingTypeAvailability(
  durationMinutes: number,
  now: Temporal.Instant,
): MeetingTypeAvailability {
  const { window, days } = buildSchedule(durationMinutes, now)
  return {
    timeZone: TIME_ZONE,
    window,
    days: days.map(({ date, slots }) => ({
      date,
      slots: slots.map(({ startsAt, endsAt }) => ({
        startsAt: toApiDateTime(startsAt),
        endsAt: toApiDateTime(endsAt),
        available: true,
      })),
    })),
  }
}

/**
 * Слот типа длительностью `durationMinutes`, который начинается в момент `startsAt`,
 * если такой есть в окне на момент `now` (ADR-0004, п. 7). Сравниваются абсолютные
 * моменты, поэтому смещение строки, из которой получен `startsAt`, не важно.
 */
export function findSlot(
  durationMinutes: number,
  now: Temporal.Instant,
  startsAt: Temporal.Instant,
): Slot | undefined {
  for (const day of buildSchedule(durationMinutes, now).days) {
    const slot = day.slots.find((candidate) =>
      candidate.startsAt.toInstant().equals(startsAt),
    )
    if (slot) return slot
  }
  return undefined
}

/** Рабочие часы (BR-04, BR-05) и шаг сетки (BR-10). */
const WORKDAY_START = Temporal.PlainTime.from('09:00')
const WORKDAY_MINUTES = 9 * 60
const STEP_MINUTES = 30

// Сетка строится в местном времени Варшавы; встреча целиком внутри 09:00–18:00,
// поэтому последнее начало — 18:00 − длительность вниз до шага (BR-11).
// Переходы на летнее/зимнее время ночью, так что местное время всегда существует.
function slotsOfDay(date: Temporal.PlainDate, durationMinutes: number): Slot[] {
  const slots: Slot[] = []
  for (
    let offset = 0;
    offset + durationMinutes <= WORKDAY_MINUTES;
    offset += STEP_MINUTES
  ) {
    const startsAt = date
      .toPlainDateTime(WORKDAY_START.add({ minutes: offset }))
      .toZonedDateTime(TIME_ZONE, { disambiguation: 'reject' })
    slots.push({ startsAt, endsAt: startsAt.add({ minutes: durationMinutes }) })
  }
  return slots
}
