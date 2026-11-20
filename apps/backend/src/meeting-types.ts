import type { FieldError } from './generated/index.ts'

// Правила полей типа встречи, которые не выражаются схемой контракта
// (docs/specs/booking.md §2, §5): обрезка пробелов до проверки схемой
// и кратность длительности 15 минутам (BR-07).

const DURATION_STEP_MINUTES = 15

/** Ошибки полей сверх схемы контракта: длительность не кратна 15 минутам. */
export function meetingTypeRuleErrors(body: unknown): FieldError[] {
  const { durationMinutes } = (body ?? {}) as { durationMinutes?: unknown }
  return Number.isInteger(durationMinutes) &&
    (durationMinutes as number) % DURATION_STEP_MINUTES !== 0
    ? [{ field: 'durationMinutes', code: 'OUT_OF_RANGE' }]
    : []
}

/** Обрезает `title` и `description`; пустое описание и `null` — как отсутствие поля. */
export function normalizeMeetingTypeInput<T>(body: T): T {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return body
  }
  const normalized: Record<string, unknown> = Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== null),
  )
  for (const field of ['title', 'description']) {
    const value = normalized[field]
    if (typeof value === 'string') normalized[field] = value.trim()
  }
  if (normalized.description === '') delete normalized.description
  return normalized as T
}
