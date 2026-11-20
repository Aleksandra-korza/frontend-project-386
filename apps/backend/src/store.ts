import { Temporal } from 'temporal-polyfill'
import { overlaps, type Interval } from './bookings.ts'
import type {
  Booking,
  MeetingType,
  UpcomingBooking,
} from './generated/index.ts'

// Данные сервиса в памяти процесса (D-06). Тесты передают заполненное
// хранилище в buildApp() — без тестовых эндпоинтов.
// Инвариант: тип каждого бронирования существует (типы встреч не удаляются);
// нарушение — ошибка программы, а не ответ API.
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
   * Бронирования с названием типа, начало которых строго позже `after`,
   * по возрастанию начала (BR-24).
   */
  listUpcomingBookings(after: Temporal.Instant): UpcomingBooking[]
  /**
   * Добавляет бронирование существующего типа, если его интервал не пересекается ни с одним
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
  const findMeetingType = (id: string) =>
    meetingTypes.find((candidate) => candidate.id === id)
  const meetingTypeOf = (booking: Booking) => {
    const meetingType = findMeetingType(booking.meetingTypeId)
    if (!meetingType) {
      throw new Error(
        `Booking "${booking.id}" references unknown meeting type "${booking.meetingTypeId}"`,
      )
    }
    return meetingType
  }
  const bookings = (initial.bookings ?? []).map((booking) => ({
    booking: { ...booking },
    meetingTypeTitle: meetingTypeOf(booking).title,
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
      const meetingType = findMeetingType(id)
      return meetingType && { ...meetingType }
    },
    listBookedIntervals: () => bookings.map(({ interval }) => interval),
    listUpcomingBookings: (after) =>
      bookings
        .filter(
          ({ interval }) =>
            Temporal.Instant.compare(interval.startsAt, after) > 0,
        )
        .sort((first, second) =>
          Temporal.Instant.compare(
            first.interval.startsAt,
            second.interval.startsAt,
          ),
        )
        .map(({ booking, meetingTypeTitle }) => ({
          ...booking,
          meetingTypeTitle,
        })),
    addBookingIfFree: (booking) => {
      const { title: meetingTypeTitle } = meetingTypeOf(booking)
      const interval = intervalOf(booking)
      // Линейный перебор: один владелец, окно 14 дней (ADR-0003).
      if (bookings.some((stored) => overlaps(stored.interval, interval))) {
        return false
      }
      bookings.push({ booking: { ...booking }, meetingTypeTitle, interval })
      return true
    },
  }
}
