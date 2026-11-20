import type { ActionFunctionArgs } from 'react-router'
import { createMeetingType, type MeetingType } from '@/client'
import { type FieldErrors, fieldErrorsByName } from '@/lib/fieldErrors'
import { formText } from '@/lib/form'

export type CreateMeetingTypeResult =
  | { status: 'created' }
  /** Ошибки полей: имя поля → код ошибки. */
  | { status: 'invalid'; fieldErrors: FieldErrors }
  | { status: 'idTaken' }
  /** Сеть или 5xx. */
  | { status: 'failed' }

// Создание типа встречи из формы /admin (docs/specs/booking.md §6.2).
// Обрезку и проверку полей выполняет сервер; клиент только передаёт значения.
export async function createMeetingTypeAction({
  request,
}: ActionFunctionArgs): Promise<CreateMeetingTypeResult> {
  const form = await request.formData()
  const text = formText(form)
  const description = text('description')
  const duration = text('durationMinutes')
  // Пустые необязательные значения не отправляются: ошибку
  // обязательности назначает сервер.
  const body = {
    id: text('id'),
    title: text('title'),
    ...(description !== '' && { description }),
    ...(duration !== '' && { durationMinutes: Number(duration) }),
  } as MeetingType

  try {
    const { error, response } = await createMeetingType({ body })
    if (response?.ok) return { status: 'created' }
    if (error?.code === 'MEETING_TYPE_ID_TAKEN') return { status: 'idTaken' }
    if (error?.code === 'VALIDATION_ERROR' && error.fieldErrors?.length) {
      return {
        status: 'invalid',
        fieldErrors: fieldErrorsByName(error.fieldErrors),
      }
    }
  } catch {
    // Сетевая ошибка — то же сообщение, что и для 5xx.
  }
  return { status: 'failed' }
}
