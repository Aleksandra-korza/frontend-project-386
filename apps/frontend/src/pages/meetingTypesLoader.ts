import { listMeetingTypes } from '@/client'

// Каталог типов встреч для /book (docs/specs/booking.md §6.1).
// Ошибка запроса уходит в ErrorBoundary маршрута.
export async function meetingTypesLoader() {
  const { data } = await listMeetingTypes({ throwOnError: true })
  return data
}
