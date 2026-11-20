import {
  data,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
} from 'react-router'
import {
  getMeetingType,
  getMeetingTypeAvailability,
  type ErrorResponse,
} from '@/client'

const isMeetingTypeNotFound = (error: unknown) =>
  (error as Partial<ErrorResponse> | null)?.code === 'MEETING_TYPE_NOT_FOUND'

// Тип встречи и доступность времени для /book/:typeId (docs/specs/booking.md §6.1).
// MEETING_TYPE_NOT_FOUND — ответ 404 маршрута, остальные ошибки — ErrorBoundary как есть.
export async function chooseSlotLoader({ params }: LoaderFunctionArgs) {
  const path = { id: params.typeId ?? '' }
  try {
    const [meetingType, availability] = await Promise.all([
      getMeetingType({ path, throwOnError: true }),
      getMeetingTypeAvailability({ path, throwOnError: true }),
    ])
    return { meetingType: meetingType.data, availability: availability.data }
  } catch (error) {
    if (isMeetingTypeNotFound(error)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- ответ маршрута React Router
      throw data('Meeting type not found', { status: 404 })
    }
    throw error
  }
}

// Выбор дня меняет только ?date=: данные те же, повторный запрос не нужен.
// Явная перезагрузка («Повторить», после бронирования) идёт по тому же адресу.
export function chooseSlotShouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search
  ) {
    return false
  }
  return defaultShouldRevalidate
}
