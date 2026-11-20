import { Ajv } from 'ajv'
import { Temporal } from 'temporal-polyfill'
import { afterAll, describe, expect, test } from 'vitest'
import { buildApp } from './app.ts'
import { openapi } from './contract.ts'
import { createStore } from './store.ts'
import { sampleMeetingTypes } from './testing/meeting-types.ts'

// Ответы backend сверяются со сгенерированным контрактом api/generated/openapi.json
// (mise run codegen) независимо от схем, по которым Fastify сериализует ответ.

// Валидатор схемы ответа из OpenAPI: $ref на components/schemas разрешается
// внутри того же документа. strict: false — в документе есть ключи OpenAPI.
const ajv = new Ajv({ strict: false })
// Формат целых чисел OpenAPI (TypeSpec int32), которого нет в ajv по умолчанию.
ajv.addFormat('int32', {
  type: 'number',
  validate: (value) => Number.isInteger(value) && Math.abs(value) < 2 ** 31,
})
// Форматы дат OpenAPI: день `YYYY-MM-DD` и дата-время ISO 8601 обязательно со смещением
// (docs/specs/booking.md §2, ADR-0004).
ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/)
ajv.addFormat(
  'date-time',
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
)
ajv.addSchema(openapi, 'openapi')
const responseSchemaRef = (path: string, method: string, status: string) =>
  `openapi#/paths/${path.replaceAll('/', '~1')}/${method}/responses/${status}/content/application~1json/schema`

describe('контракт OpenAPI', () => {
  const app = buildApp({
    store: createStore({ meetingTypes: sampleMeetingTypes }),
    // Окно бронирования — 2026-11-21…2026-12-04.
    now: () => Temporal.Instant.from('2026-11-20T14:00:00Z'),
  })

  afterAll(async () => {
    await app.close()
  })

  test('GET /api/health соответствует контракту', async () => {
    expect(
      openapi.paths['/api/health']?.get?.responses['200']?.content?.[
        'application/json'
      ],
    ).toBeDefined()
    const validate = ajv.compile({
      $ref: responseSchemaRef('/api/health', 'get', '200'),
    })

    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toMatch(/^application\/json/)
    const body: unknown = response.json()
    expect(validate(body), ajv.errorsText(validate.errors)).toBe(true)
  })

  test('GET /api/meeting-types соответствует контракту', async () => {
    const validate = ajv.compile({
      $ref: responseSchemaRef('/api/meeting-types', 'get', '200'),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/meeting-types',
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toMatch(/^application\/json/)
    const body: unknown = response.json()
    expect(body).toHaveLength(2)
    expect(validate(body), ajv.errorsText(validate.errors)).toBe(true)
  })

  test.each([
    {
      url: '/api/meeting-types/intro-call',
      path: '/api/meeting-types/{id}',
      status: 200,
    },
    {
      url: '/api/meeting-types/unknown',
      path: '/api/meeting-types/{id}',
      status: 404,
    },
    {
      url: '/api/meeting-types/intro-call/availability',
      path: '/api/meeting-types/{id}/availability',
      status: 200,
    },
    {
      url: '/api/meeting-types/unknown/availability',
      path: '/api/meeting-types/{id}/availability',
      status: 404,
    },
  ])(
    'GET $url ($status) соответствует контракту',
    async ({ url, path, status }) => {
      const validate = ajv.compile({
        $ref: responseSchemaRef(path, 'get', String(status)),
      })

      const response = await app.inject({ method: 'GET', url })

      expect(response.statusCode).toBe(status)
      expect(response.headers['content-type']).toMatch(/^application\/json/)
      const body: unknown = response.json()
      expect(validate(body), ajv.errorsText(validate.errors)).toBe(true)
    },
  )

  test.each([
    [
      201,
      { id: 'team-sync', title: 'Синхронизация', durationMinutes: 45 },
      undefined,
    ],
    [
      400,
      { id: 'Bad Id', title: ' ', description: 1, durationMinutes: 20 },
      'VALIDATION_ERROR',
    ],
    [400, '{', 'VALIDATION_ERROR'],
    [
      409,
      { id: 'intro-call', title: 'Знакомство', durationMinutes: 30 },
      'MEETING_TYPE_ID_TAKEN',
    ],
  ])(
    'POST /api/meeting-types: ответ %i соответствует контракту',
    async (status, payload, code) => {
      const validate = ajv.compile({
        $ref: responseSchemaRef('/api/meeting-types', 'post', String(status)),
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/meeting-types',
        headers: { 'content-type': 'application/json' },
        payload:
          typeof payload === 'string' ? payload : JSON.stringify(payload),
      })

      expect(response.statusCode).toBe(status)
      expect(response.headers['content-type']).toMatch(/^application\/json/)
      const body = response.json<{ code?: string }>()
      expect(body.code).toBe(code)
      expect(validate(body), ajv.errorsText(validate.errors)).toBe(true)
    },
  )

  // Порядок важен: 409 — повтор бронирования из первого случая.
  const booking = {
    meetingTypeId: 'intro-call',
    startsAt: '2026-11-23T10:00:00+01:00',
    guestName: 'Анна',
    guestEmail: 'anna@example.com',
  }
  test.each([
    [201, booking, undefined],
    [
      400,
      { ...booking, startsAt: '2026-11-23T10:15:00+01:00', guestName: '' },
      'VALIDATION_ERROR',
    ],
    [404, { ...booking, meetingTypeId: 'unknown' }, 'MEETING_TYPE_NOT_FOUND'],
    [409, booking, 'SLOT_TAKEN'],
  ])(
    'POST /api/bookings: ответ %i соответствует контракту',
    async (status, payload, code) => {
      const validate = ajv.compile({
        $ref: responseSchemaRef('/api/bookings', 'post', String(status)),
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify(payload),
      })

      expect(response.statusCode).toBe(status)
      expect(response.headers['content-type']).toMatch(/^application\/json/)
      const body = response.json<{ code?: string }>()
      expect(body.code).toBe(code)
      expect(validate(body), ajv.errorsText(validate.errors)).toBe(true)
    },
  )

  // После POST /api/bookings: в списке есть созданное бронирование.
  test('GET /api/bookings соответствует контракту', async () => {
    const validate = ajv.compile({
      $ref: responseSchemaRef('/api/bookings', 'get', '200'),
    })

    const response = await app.inject({ method: 'GET', url: '/api/bookings' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toMatch(/^application\/json/)
    const body: unknown = response.json()
    expect(body).toHaveLength(1)
    expect(validate(body), ajv.errorsText(validate.errors)).toBe(true)
  })
})
