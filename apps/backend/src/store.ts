import { Temporal } from 'temporal-polyfill'
import { overlaps, type Interval } from './bookings.ts'
import type { Booking, MeetingType } from './generated/index.ts'

// Данные сервиса в памяти процесса (D-06). Тесты передают заполненное
// хранилище в buildApp() — без тестовых эндпоинтов.
export type Store = {
  /** Типы встреч в порядке создания, старые первыми. */
  listMeetingTypes(): MeetingType[]
  /** Добавляет тип встречи в конец каталога; false — `id` уже занят. */
  addMeetingType(meetingType: MeetingType): boolean
  /** Тип встречи по идентификатору или undefined. */
  getMeetingType(id: string): MeetingType | undefined
  /** Интервалы всех бронирований любых типов (BR-16). */
  listBookedIntervals(): Interval[]
  /**
   * Добавляет бронирование, если его интервал не пересекается ни с одним
   * бронированием любого типа; false — время занято. Проверка и вставка —
   * одна синхронная операция (ADR-0003): никаких `await` внутри.
   */
  addBookingIfFree(booking: Booking): boolean
}

const intervalOf = ({ startsAt, endsAt }: Booking): Interval => ({
  startsAt: Temporal.Instant.from(startsAt),
  endsAt: Temporal.Instant.from(endsAt),
})

export function createStore(
  initial: { meetingTypes?: MeetingType[]; bookings?: Booking[] } = {},
): Store {
  const meetingTypes = [...(initial.meetingTypes ?? [])]
  const bookings = (initial.bookings ?? []).map((booking) => ({
    booking: { ...booking },
    interval: intervalOf(booking),
  }))

  return {
    listMeetingTypes: () =>
      meetingTypes.map((meetingType) => ({ ...meetingType })),
    addMeetingType: (meetingType) => {
      if (meetingTypes.some(({ id }) => id === meetingType.id)) return false
      meetingTypes.push({ ...meetingType })
      return true
    },
    getMeetingType: (id) => {
      const meetingType = meetingTypes.find((candidate) => candidate.id === id)
      return meetingType && { ...meetingType }
    },
    listBookedIntervals: () => bookings.map(({ interval }) => interval),
    addBookingIfFree: (booking) => {
      const interval = intervalOf(booking)
      // Линейный перебор: один владелец, окно 14 дней (ADR-0003).
      if (bookings.some((stored) => overlaps(stored.interval, interval))) {
        return false
      }
      bookings.push({ booking: { ...booking }, interval })
      return true
    },
  }
}
