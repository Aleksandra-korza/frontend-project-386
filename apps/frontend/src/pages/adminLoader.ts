import { listMeetingTypes } from '@/client'

// Данные «Раздела владельца» /admin (docs/specs/booking.md §6.2).
// Ошибка запроса уходит в ErrorBoundary маршрута.
export async function adminLoader() {
  const { data: meetingTypes } = await listMeetingTypes({ throwOnError: true })
  return { meetingTypes }
}
