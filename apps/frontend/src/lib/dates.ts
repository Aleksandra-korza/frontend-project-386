import { Temporal } from 'temporal-polyfill'

// Даты и время в интерфейсе (ADR-0004). Строки — из ответа API: день `YYYY-MM-DD`,
// время — ISO 8601 со смещением; показываются в часовом поясе из ответа.

/**
 * Часовой пояс сервиса (BR-03). Списки без поля `timeZone` в ответе API
 * (предстоящие бронирования) показываются в нём.
 */
export const TIME_ZONE = 'Europe/Warsaw'

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const WEEKDAYS = [
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
  'воскресенье',
]

/** Заголовки столбцов календаря, неделя с понедельника. */
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** «Ноябрь 2026». */
export const formatMonth = (month: Temporal.PlainYearMonth) =>
  `${MONTHS[month.month - 1] ?? ''} ${String(month.year)}`

/** «23 ноября». */
export const formatDayMonth = (date: Temporal.PlainDate) =>
  `${String(date.day)} ${MONTHS_GENITIVE[date.month - 1] ?? ''}`

/** «понедельник, 23 ноября». */
export const formatDay = (date: Temporal.PlainDate) =>
  `${WEEKDAYS[date.dayOfWeek - 1] ?? ''}, ${formatDayMonth(date)}`

/** «Понедельник, 23 ноября» — заголовок дня. */
export const formatDayTitle = (date: Temporal.PlainDate) => {
  const day = formatDay(date)
  return day.charAt(0).toUpperCase() + day.slice(1)
}

/** «10:30» — время момента `dateTime` в поясе `timeZone`. */
export const formatTime = (dateTime: string, timeZone: string) =>
  Temporal.Instant.from(dateTime)
    .toZonedDateTimeISO(timeZone)
    .toPlainTime()
    .toString({ smallestUnit: 'minute' })

/** «20.11.2026, 15:00» — дата и время момента `dateTime` в поясе `timeZone`. */
export function formatDateTime(dateTime: string, timeZone: string) {
  const local = Temporal.Instant.from(dateTime).toZonedDateTimeISO(timeZone)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(local.day)}.${pad(local.month)}.${String(local.year)}, ${formatTime(dateTime, timeZone)}`
}

/** Местный день момента `dateTime` в поясе `timeZone`. */
export const localDate = (dateTime: string, timeZone: string) =>
  Temporal.Instant.from(dateTime).toZonedDateTimeISO(timeZone).toPlainDate()

/** День `YYYY-MM-DD` или undefined, если строка не дата. */
export function parseDate(value: string | null) {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  try {
    return Temporal.PlainDate.from(value, { overflow: 'reject' })
  } catch {
    return undefined
  }
}
