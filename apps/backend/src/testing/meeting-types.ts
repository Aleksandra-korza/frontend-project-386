import type { MeetingType } from '../generated/index.ts'

// Типы встреч для тестов в порядке создания: с описанием и без.
export const sampleMeetingTypes: MeetingType[] = [
  { id: 'intro-call', title: 'Знакомство', durationMinutes: 30 },
  {
    id: 'consultation',
    title: 'Консультация',
    description: 'Разбор вашего вопроса',
    durationMinutes: 90,
  },
]
