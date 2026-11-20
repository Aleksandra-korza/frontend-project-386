import type { MeetingType } from './generated/index.ts'

// Данные сервиса в памяти процесса (D-06). Тесты передают заполненное
// хранилище в buildApp() — без тестовых эндпоинтов.
export type Store = {
  /** Типы встреч в порядке создания, старые первыми. */
  listMeetingTypes(): MeetingType[]
  /** Добавляет тип встречи в конец каталога; false — `id` уже занят. */
  addMeetingType(meetingType: MeetingType): boolean
  /** Тип встречи по идентификатору или undefined. */
  getMeetingType(id: string): MeetingType | undefined
}

export function createStore(
  initial: { meetingTypes?: MeetingType[] } = {},
): Store {
  const meetingTypes = [...(initial.meetingTypes ?? [])]

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
  }
}
