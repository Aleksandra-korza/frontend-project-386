import { readFileSync } from 'node:fs'

// Сгенерированный контракт (mise run codegen). Маршруты регистрируются вручную,
// а схемы запросов и ответов берутся из него (ADR-0005).
type Operation = {
  responses: Record<
    string,
    { content?: Record<string, { schema: unknown } | undefined> } | undefined
  >
}

export const openapi = JSON.parse(
  readFileSync(
    new URL('../../../api/generated/openapi.json', import.meta.url),
    'utf8',
  ),
) as {
  paths: Record<string, Record<string, Operation | undefined> | undefined>
  components: unknown
}

// Компоненты контракта регистрируются в Fastify под этим $id (app.addSchema),
// поэтому ссылки `#/components/...` из схем операций переписываются на него.
const OPENAPI_SCHEMA_ID = 'openapi'

export const openapiComponentsSchema = {
  $id: OPENAPI_SCHEMA_ID,
  components: openapi.components,
}

const withAbsoluteRefs = (schema: unknown): unknown => {
  if (Array.isArray(schema)) return schema.map(withAbsoluteRefs)
  if (schema === null || typeof schema !== 'object') return schema
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      key === '$ref' && typeof value === 'string' && value.startsWith('#/')
        ? `${OPENAPI_SCHEMA_ID}${value}`
        : withAbsoluteRefs(value),
    ]),
  )
}

/** JSON-схема ответа операции из контракта; ошибка, если её там нет. */
export function responseSchema(path: string, method: string, status: number) {
  const schema =
    openapi.paths[path]?.[method]?.responses[String(status)]?.content?.[
      'application/json'
    ]?.schema
  if (schema === undefined) {
    throw new Error(
      `В контракте нет ответа ${status} для ${method.toUpperCase()} ${path}`,
    )
  }
  return withAbsoluteRefs(schema)
}
