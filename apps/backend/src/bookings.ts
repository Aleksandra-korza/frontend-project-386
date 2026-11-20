import { Temporal } from 'temporal-polyfill'

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
export function normalizeBookingInput<T>(body: T): T {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return body
  }
  const normalized: Record<string, unknown> = Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== null),
  )
  if (typeof normalized.guestName === 'string') {
    normalized.guestName = normalized.guestName.trim()
  }
  return normalized as T
}
