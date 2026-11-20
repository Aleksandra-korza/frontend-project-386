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

type ErrorBody = {
  code: string
  message: string
  fieldErrors?: { field: string; code: string }[]
}

const postMeetingType = (body: unknown) =>
  server!.request('/api/meeting-types', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/meeting-types', () => {
  test('создаёт тип встречи: 201, тип в ответе и в конце каталога', async () => {
    server = await startTestServer({
      store: createStore({ meetingTypes: sampleMeetingTypes }),
    })

    const response = await postMeetingType({
      id: 'team-sync',
      title: '  Синхронизация  ',
      description: '  Еженедельная встреча  ',
      durationMinutes: 45,
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      id: 'team-sync',
      title: 'Синхронизация',
      description: 'Еженедельная встреча',
      durationMinutes: 45,
    })
    const catalog = (await (
      await server.request('/api/meeting-types')
    ).json()) as { id: string }[]
    expect(catalog.map(({ id }) => id)).toEqual([
      'intro-call',
      'consultation',
      'team-sync',
    ])
  })

  test('на занятый id отвечает 409 MEETING_TYPE_ID_TAKEN и не меняет каталог', async () => {
    server = await startTestServer({
      store: createStore({ meetingTypes: sampleMeetingTypes }),
    })

    const response = await postMeetingType({
      id: 'intro-call',
      title: 'Другое знакомство',
      durationMinutes: 60,
    })

    expect(response.status).toBe(409)
    const body = (await response.json()) as ErrorBody
    expect(Object.keys(body).sort()).toEqual(['code', 'message'])
    expect(body.code).toBe('MEETING_TYPE_ID_TAKEN')
    expect(typeof body.message).toBe('string')
    expect(await (await server.request('/api/meeting-types')).json()).toEqual(
      sampleMeetingTypes,
    )
  })

  test('отвечает 400 VALIDATION_ERROR с ошибками всех полей сразу', async () => {
    server = await startTestServer()

    const response = await postMeetingType({
      id: 'Intro_Call',
      title: '   ',
      description: 'д'.repeat(501),
      durationMinutes: 20,
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as ErrorBody
    expect(Object.keys(body).sort()).toEqual(['code', 'fieldErrors', 'message'])
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(typeof body.message).toBe('string')
    expect(body.fieldErrors).toHaveLength(4)
    expect(body.fieldErrors).toEqual(
      expect.arrayContaining([
        { field: 'id', code: 'INVALID_FORMAT' },
        { field: 'title', code: 'REQUIRED' },
        { field: 'description', code: 'TOO_LONG' },
        { field: 'durationMinutes', code: 'OUT_OF_RANGE' },
      ]),
    )
    expect(await (await server.request('/api/meeting-types')).json()).toEqual(
      [],
    )
  })

  test('без обязательных полей отвечает REQUIRED по каждому из них', async () => {
    server = await startTestServer()

    const response = await postMeetingType({ title: null })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { fieldErrors: unknown[] }
    expect(body.fieldErrors).toHaveLength(3)
    expect(body.fieldErrors).toEqual(
      expect.arrayContaining([
        { field: 'id', code: 'REQUIRED' },
        { field: 'title', code: 'REQUIRED' },
        { field: 'durationMinutes', code: 'REQUIRED' },
      ]),
    )
  })

  test('на тело не-JSON-объект отвечает 400 VALIDATION_ERROR', async () => {
    server = await startTestServer()

    const response = await postMeetingType([1, 2])

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})
