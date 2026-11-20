import type { FieldErrorCode } from '@/client'

/** Подсказка формата идентификатора типа встречи; она же — текст его ошибки формата. */
export const MEETING_TYPE_ID_HINT =
  'Латиница, цифры и дефис, 3–40 символов, например intro-call'

// Тексты ошибок полей по коду из ответа API (docs/specs/booking.md §6.3).
const MESSAGES: Record<string, Partial<Record<FieldErrorCode, string>>> = {
  id: {
    REQUIRED: 'Укажите идентификатор',
    INVALID_FORMAT: MEETING_TYPE_ID_HINT,
  },
  title: {
    REQUIRED: 'Укажите название',
    TOO_LONG: 'Название — не длиннее 80 символов',
  },
  description: {
    TOO_LONG: 'Описание — не длиннее 500 символов',
  },
  guestName: {
    REQUIRED: 'Укажите имя',
    TOO_LONG: 'Имя — не длиннее 100 символов',
  },
  guestEmail: {
    REQUIRED: 'Укажите email',
    INVALID_FORMAT: 'Укажите корректный email',
    TOO_LONG: 'Email — не длиннее 254 символов',
  },
  durationMinutes: {
    REQUIRED: 'Выберите длительность',
    OUT_OF_RANGE: 'Длительность — от 15 минут до 8 часов, кратно 15 минутам',
  },
}

/** Текст ошибки поля; для сочетаний без отдельной строки — общий текст. */
export function fieldErrorMessage(field: string, code: FieldErrorCode) {
  return MESSAGES[field]?.[code] ?? 'Проверьте значение поля'
}
