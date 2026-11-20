import { Ajv } from 'ajv'
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
})
