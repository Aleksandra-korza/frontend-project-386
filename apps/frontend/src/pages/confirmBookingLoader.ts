import { redirect, type LoaderFunctionArgs } from 'react-router'
import { chooseSlotLoader } from './chooseSlotLoader'

// Тип встречи и выбранный слот для /book/:typeId/confirm?startsAt=… (docs/specs/booking.md §6.1).
// Слот и часовой пояс — из ответа доступности; если startsAt не начало слота окна,
// гость возвращается к выбору дня. Занятость слота проверяет сервер при отправке.
export async function confirmBookingLoader(args: LoaderFunctionArgs) {
  const { meetingType, availability } = await chooseSlotLoader(args)
  const startsAt = new URL(args.request.url).searchParams.get('startsAt')
  const slot = availability.days
    .flatMap((day) => day.slots)
    .find((candidate) => candidate.startsAt === startsAt)
  if (!slot) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- ответ маршрута React Router
    throw redirect(`/book/${encodeURIComponent(meetingType.id)}`)
  }
  return { meetingType, slot, timeZone: availability.timeZone }
}
