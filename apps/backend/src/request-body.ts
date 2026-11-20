// Разбор тела запроса до проверки схемой контракта (docs/specs/booking.md §5).

/**
 * Нормализует тело-объект: поля со значением `null` удаляются (как отсутствие поля),
 * затем `normalize` правит копию полей на месте. Тело не объект — возвращается как
 * есть: ошибку назначит схема.
 */
export function normalizeObjectBody<T>(
  body: T,
  normalize: (fields: Record<string, unknown>) => void,
): T {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return body
  }
  const fields: Record<string, unknown> = Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== null),
  )
  normalize(fields)
  return fields as T
}
