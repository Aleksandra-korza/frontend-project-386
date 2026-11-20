import type { ActionFunctionArgs } from 'react-router'
import {
  createMeetingType,
  type FieldErrorCode,
  type MeetingType,
} from '@/client'

export type CreateMeetingTypeResult =
  | { status: 'created' }
  /** Ошибки полей: имя поля → код ошибки. */
  | { status: 'invalid'; fieldErrors: Record<string, FieldErrorCode> }
  | { status: 'idTaken' }
  /** Сеть или 5xx. */
  | { status: 'failed' }

// Создание типа встречи из формы /admin (docs/specs/booking.md §6.2).
// Обрезку и проверку полей выполняет сервер; клиент только передаёт значения.
export async function createMeetingTypeAction({
  request,
}: ActionFunctionArgs): Promise<CreateMeetingTypeResult> {
  const form = await request.formData()
  const text = (name: string) => {
    const value = form.get(name)
    return typeof value === 'string' ? value : ''
  }
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
