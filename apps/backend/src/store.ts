import type { MeetingType } from './generated/index.ts'

// Данные сервиса в памяти процесса (D-06). Тесты передают заполненное
// хранилище в buildApp() — без тестовых эндпоинтов.
export type Store = {
  /** Типы встреч в порядке создания, старые первыми. */
  listMeetingTypes(): MeetingType[]
}

export function createStore(
  initial: { meetingTypes?: MeetingType[] } = {},
): Store {
  const meetingTypes = [...(initial.meetingTypes ?? [])]

  return {
    listMeetingTypes: () =>
      meetingTypes.map((meetingType) => ({ ...meetingType })),
  }
}
