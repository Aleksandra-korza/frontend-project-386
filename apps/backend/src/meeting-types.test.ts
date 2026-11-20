import { afterEach, describe, expect, test } from 'vitest'
import { createStore } from './store.ts'
import { startTestServer } from './testing/http.ts'
import { sampleMeetingTypes } from './testing/meeting-types.ts'

let server: Awaited<ReturnType<typeof startTestServer>> | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

describe('GET /api/meeting-types', () => {
  test('без типов встреч отвечает пустым списком', async () => {
    server = await startTestServer()

    const response = await server.request('/api/meeting-types')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })

  test('возвращает типы встреч в порядке создания, старые первыми', async () => {
    server = await startTestServer({
      store: createStore({ meetingTypes: sampleMeetingTypes }),
    })

    const response = await server.request('/api/meeting-types')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([
      { id: 'intro-call', title: 'Знакомство', durationMinutes: 30 },
      {
        id: 'consultation',
        title: 'Консультация',
        description: 'Разбор вашего вопроса',
        durationMinutes: 90,
      },
    ])
  })
})
