import { data, redirect, type ActionFunctionArgs } from 'react-router'
import { type Booking, createBooking, type ErrorResponse } from '@/client'
import { localDate } from '@/lib/dates'
import { type FieldErrors, fieldErrorsByName } from '@/lib/fieldErrors'
import { formText } from '@/lib/form'

export type CreateBookingResult =
  | { status: 'booked'; booking: Booking }
  /** Ошибки полей гостя: имя поля → код ошибки. */
  | { status: 'invalid'; fieldErrors: FieldErrors }
  /** Сеть или 5xx. */
  | { status: 'failed' }

/** Почему гость вернулся к выбору дня: параметр `?error=` страницы выбора дня. */
export type BackToDayReason = 'SLOT_TAKEN' | 'INVALID_SLOT'

// Создание бронирования из формы подтверждения (docs/specs/booking.md §6.1).
// Проверку полей выполняет сервер. При SLOT_TAKEN и ошибке startsAt гость
// возвращается к выбору того же дня: его loader заново загружает доступность.
// MEETING_TYPE_NOT_FOUND — ответ 404 маршрута, как у loader (RouteError, §6.3).
export async function createBookingAction({
  request,
  params,
}: ActionFunctionArgs): Promise<CreateBookingResult | Response> {
  const form = await request.formData()
  const text = formText(form)
  const meetingTypeId = params.typeId ?? ''
  const startsAt = text('startsAt')

  const backToDay = (reason: BackToDayReason) => {
    const search = new URLSearchParams({ error: reason })
    const date = localDateOf(startsAt, text('timeZone'))
    if (date) search.set('date', date)
    return redirect(
      `/book/${encodeURIComponent(meetingTypeId)}?${search.toString()}`,
    )
  }

  let error: ErrorResponse | undefined
  try {
    const result = await createBooking({
      body: {
        meetingTypeId,
        startsAt,
        guestName: text('guestName'),
        guestEmail: text('guestEmail'),
      },
    })
    if (result.response?.ok && result.data) {
      return { status: 'booked', booking: result.data }
    }
    error = result.error
  } catch {
    // Сетевая ошибка — то же сообщение, что и для 5xx.
    return { status: 'failed' }
  }

  if (error?.code === 'MEETING_TYPE_NOT_FOUND') {
    // Тип удалён после загрузки страницы: тот же экран, что и у loader.
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- ответ маршрута React Router
    throw data('Meeting type not found', { status: 404 })
  }
  if (error?.code === 'SLOT_TAKEN') return backToDay('SLOT_TAKEN')
  if (error?.code === 'VALIDATION_ERROR' && error.fieldErrors?.length) {
    // startsAt гость на этой странице не вводит: любая его ошибка — время недоступно.
    if (error.fieldErrors.some(({ field }) => field === 'startsAt')) {
      return backToDay('INVALID_SLOT')
    }
    return {
      status: 'invalid',
      fieldErrors: fieldErrorsByName(error.fieldErrors),
    }
  }
  return { status: 'failed' }
}

/**
 * Местный день начала слота в часовом поясе из ответа доступности (ADR-0004);
 * undefined, если значения формы не момент и не часовой пояс.
 */
function localDateOf(startsAt: string, timeZone: string) {
  try {
    return localDate(startsAt, timeZone).toString()
  } catch {
    return undefined
  }
}
