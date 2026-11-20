import { redirect, type ActionFunctionArgs } from 'react-router'
import { type Booking, createBooking, type FieldErrorCode } from '@/client'

export type CreateBookingResult =
  | { status: 'booked'; booking: Booking }
  /** Ошибки полей гостя: имя поля → код ошибки. */
  | { status: 'invalid'; fieldErrors: Record<string, FieldErrorCode> }
  /** Сеть или 5xx. */
  | { status: 'failed' }

/** Почему гость вернулся к выбору дня: параметр `?error=` страницы выбора дня. */
export type BackToDayReason = 'SLOT_TAKEN' | 'INVALID_SLOT'

// Создание бронирования из формы подтверждения (docs/specs/booking.md §6.1).
// Проверку полей выполняет сервер. При SLOT_TAKEN и ошибке startsAt гость
// возвращается к выбору того же дня: его loader заново загружает доступность.
export async function createBookingAction({
  request,
  params,
}: ActionFunctionArgs): Promise<CreateBookingResult | Response> {
  const form = await request.formData()
  const text = (name: string) => {
    const value = form.get(name)
    return typeof value === 'string' ? value : ''
  }
  const meetingTypeId = params.typeId ?? ''
  const startsAt = text('startsAt')

  const backToDay = (reason: BackToDayReason) => {
    const search = new URLSearchParams({
      date: startsAt.slice(0, 10),
      error: reason,
    })
    return redirect(
      `/book/${encodeURIComponent(meetingTypeId)}?${search.toString()}`,
    )
  }

  try {
    const { data, error, response } = await createBooking({
      body: {
        meetingTypeId,
        startsAt,
        guestName: text('guestName'),
        guestEmail: text('guestEmail'),
      },
    })
    if (response?.ok && data) return { status: 'booked', booking: data }
    if (error?.code === 'SLOT_TAKEN') return backToDay('SLOT_TAKEN')
    if (error?.code === 'VALIDATION_ERROR' && error.fieldErrors?.length) {
      // startsAt гость на этой странице не вводит: любая его ошибка — время недоступно.
      if (error.fieldErrors.some(({ field }) => field === 'startsAt')) {
        return backToDay('INVALID_SLOT')
      }
      return {
        status: 'invalid',
        fieldErrors: Object.fromEntries(
          error.fieldErrors.map(({ field, code }) => [field, code]),
        ),
      }
    }
  } catch {
    // Сетевая ошибка — то же сообщение, что и для 5xx.
  }
  return { status: 'failed' }
}
