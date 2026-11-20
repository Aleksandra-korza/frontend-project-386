import { redirect, type LoaderFunctionArgs } from 'react-router'
import { Temporal } from 'temporal-polyfill'
import { chooseSlotLoader } from './chooseSlotLoader'

// Тип встречи и выбранный слот для /book/:typeId/confirm?startsAt=… (docs/specs/booking.md §6.1).
// Слот и часовой пояс — из ответа доступности; если startsAt не начало слота окна,
// гость возвращается к выбору дня. Занятость слота проверяет сервер при отправке.
export async function confirmBookingLoader(args: LoaderFunctionArgs) {
  const { meetingType, availability } = await chooseSlotLoader(args)
  const startsAt = instantOf(
    new URL(args.request.url).searchParams.get('startsAt'),
  )
  // Моменты сравниваются как моменты, а не строки: смещение может быть любым (ADR-0004).
  const slot =
    startsAt &&
    availability.days
      .flatMap((day) => day.slots)
      .find((candidate) =>
        Temporal.Instant.from(candidate.startsAt).equals(startsAt),
      )
  if (!slot) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- ответ маршрута React Router
    throw redirect(`/book/${encodeURIComponent(meetingType.id)}`)
  }
  return { meetingType, slot, timeZone: availability.timeZone }
}

/** Момент из строки ISO 8601 со смещением или undefined, если строка не момент. */
function instantOf(value: string | null) {
  if (value === null) return undefined
  try {
    return Temporal.Instant.from(value)
  } catch {
    return undefined
  }
}
