import { readFile } from 'node:fs/promises'
import { Ajv } from 'ajv'
import { afterAll, describe, expect, test } from 'vitest'
import { buildApp } from './app.ts'

// Маршруты backend пока написаны вручную, поэтому ответы сверяются
// со сгенерированным контрактом api/generated/openapi.json (mise run codegen).
type OpenApiDocument = {
  paths: Record<
    string,
    Record<
      string,
      { responses: Record<string, { content?: Record<string, unknown> }> }
    >
  >
}

const openapi = JSON.parse(
  await readFile(
    new URL('../../../api/generated/openapi.json', import.meta.url),
    'utf8',
  ),
) as OpenApiDocument

// Валидатор схемы ответа из OpenAPI: $ref на components/schemas разрешается
// внутри того же документа. strict: false — в документе есть ключи OpenAPI.
const ajv = new Ajv({ strict: false })
ajv.addSchema(openapi, 'openapi')
const responseSchemaRef = (path: string, method: string, status: string) =>
  `openapi#/paths/${path.replaceAll('/', '~1')}/${method}/responses/${status}/content/application~1json/schema`

describe('контракт OpenAPI', () => {
  const app = buildApp()

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
})
