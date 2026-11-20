import type { AvailabilityDay, MeetingTypeAvailability } from '@/client'

// Ответ доступности для окна 2026-11-21…2026-12-04: в каждом дне слоты 60 минут
// 09:00…17:00 (+01:00). `busy` — занятые слоты: день → времена начала.
export function availability(
  busy: Record<string, string[]> = {},
): MeetingTypeAvailability {
  const days: AvailabilityDay[] = []
  for (let day = 21; day <= 34; day += 1) {
    const date =
      day <= 30
        ? `2026-11-${String(day)}`
        : `2026-12-${String(day - 30).padStart(2, '0')}`
    const slots = Array.from({ length: 17 }, (_, index) => {
      const hours = 9 + Math.floor(index / 2)
      const minutes = index % 2 === 0 ? '00' : '30'
      const time = `${String(hours).padStart(2, '0')}:${minutes}`
      const endHours = String(hours + 1).padStart(2, '0')
      return {
        startsAt: `${date}T${time}:00+01:00`,
        endsAt: `${date}T${endHours}:${minutes}:00+01:00`,
        available: !(busy[date] ?? []).includes(time),
      }
    })
    days.push({ date, slots })
  }
  return {
    timeZone: 'Europe/Warsaw',
    window: { from: '2026-11-21', to: '2026-12-04' },
    days,
  }
}

/** Все времена начала слотов дня в ответе `availability()`. */
export const allTimes = Array.from(
  { length: 17 },
  (_, index) =>
    `${String(9 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '30'}`,
)
