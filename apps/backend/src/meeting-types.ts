import type { FieldError } from './generated/index.ts'
import { normalizeObjectBody } from './request-body.ts'

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
export const normalizeMeetingTypeInput = <T>(body: T): T =>
  normalizeObjectBody(body, (fields) => {
    for (const field of ['title', 'description']) {
      const value = fields[field]
      if (typeof value === 'string') fields[field] = value.trim()
    }
    if (fields.description === '') delete fields.description
  })
