import { Temporal } from 'temporal-polyfill'
import { normalizeObjectBody } from './request-body.ts'

// Правила бронирования (docs/specs/booking.md §2, §4; ADR-0003).

/** Интервал встречи `[startsAt, endsAt)` в абсолютных моментах. */
export type Interval = {
  startsAt: Temporal.Instant
  endsAt: Temporal.Instant
}

/**
 * Интервалы `[a1, b1)` и `[a2, b2)` пересекаются, если `a1 < b2 && a2 < b1`
 * (BR-14, BR-15); примыкание допустимо (BR-17).
 */
export function overlaps(first: Interval, second: Interval): boolean {
  return (
    Temporal.Instant.compare(first.startsAt, second.endsAt) < 0 &&
    Temporal.Instant.compare(second.startsAt, first.endsAt) < 0
  )
}

/** Обрезает имя гостя по краям; `null` — как отсутствие поля. */
export const normalizeBookingInput = <T>(body: T): T =>
  normalizeObjectBody(body, (fields) => {
    if (typeof fields.guestName === 'string') {
      fields.guestName = fields.guestName.trim()
    }
  })
