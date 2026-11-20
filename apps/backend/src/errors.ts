import type { FastifyInstance, FastifySchemaValidationError } from 'fastify'
import type {
  ErrorCode,
  ErrorResponse,
  FieldError,
  FieldErrorCode,
} from './generated/index.ts'

/** Ошибка API с единым телом `{ code, message, fieldErrors? }` (docs/specs/booking.md §5). */
export class ApiError extends Error {
  readonly statusCode: number
  readonly code: ErrorCode
  readonly fieldErrors?: FieldError[]

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    fieldErrors?: FieldError[],
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    if (fieldErrors && fieldErrors.length > 0) this.fieldErrors = fieldErrors
  }

  toResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      ...(this.fieldErrors && { fieldErrors: this.fieldErrors }),
    }
  }
}

export const meetingTypeNotFound = (id: string) =>
  new ApiError(404, 'MEETING_TYPE_NOT_FOUND', `Meeting type "${id}" not found`)

/** `400 VALIDATION_ERROR` с ошибками полей. */
export const validationError = (fieldErrors: FieldError[]) =>
  new ApiError(
    400,
    'VALIDATION_ERROR',
    'Request validation failed',
    fieldErrors,
  )

// Если у поля несколько нарушений, в ответ попадает одно — самое важное.
const PRIORITY: FieldErrorCode[] = [
  'REQUIRED',
  'INVALID_FORMAT',
  'TOO_LONG',
  'OUT_OF_RANGE',
  'INVALID_SLOT',
]

/** Сводит ошибки полей к одной записи на поле. */
export function mergeFieldErrors(...lists: FieldError[][]): FieldError[] {
  const byField = new Map<string, FieldErrorCode>()
  for (const { field, code } of lists.flat()) {
    const current = byField.get(field)
    if (!current || PRIORITY.indexOf(code) < PRIORITY.indexOf(current)) {
      byField.set(field, code)
    }
  }
  return [...byField].map(([field, code]) => ({ field, code }))
}

// Ключевое слово JSON Schema → код ошибки поля (таблица «Ошибки полей», §5).
// Длина поля с шаблоном или форматом (`id`) — часть формата, а не TOO_LONG.
function fieldErrorCode(
  error: FastifySchemaValidationError & { parentSchema?: unknown },
): FieldErrorCode | undefined {
  const schema = (error.parentSchema ?? {}) as {
    pattern?: string
    format?: string
  }
  const hasFormat = schema.pattern !== undefined || schema.format !== undefined
  const limit = (error.params as { limit?: number }).limit ?? 0
  switch (error.keyword) {
    case 'required':
      return 'REQUIRED'
    case 'type':
    case 'pattern':
    case 'format':
    case 'enum':
      return 'INVALID_FORMAT'
    case 'minLength':
      return !hasFormat && limit <= 1 ? 'REQUIRED' : 'INVALID_FORMAT'
    case 'maxLength':
      return hasFormat ? 'INVALID_FORMAT' : 'TOO_LONG'
    case 'minimum':
    case 'maximum':
    case 'multipleOf':
      return 'OUT_OF_RANGE'
    default:
      return undefined
  }
}

/** Ошибки схемы (ajv) → ошибки полей тела запроса верхнего уровня. */
export function fieldErrorsFromSchema(
  errors: FastifySchemaValidationError[] = [],
): FieldError[] {
  return mergeFieldErrors(
    errors.flatMap((error) => {
      const field =
        error.keyword === 'required'
          ? (error.params as { missingProperty: string }).missingProperty
          : error.instancePath.split('/')[1]
      const code = fieldErrorCode(error)
      return field && code ? [{ field, code }] : []
    }),
  )
}

/** Приводит все ответы с ошибкой к единому телу контракта. */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send(error.toResponse())
    }
    const { validation, statusCode, message } = error as {
      validation?: FastifySchemaValidationError[]
      statusCode?: number
      message: string
    }
    if (validation) {
      const apiError = validationError(fieldErrorsFromSchema(validation))
      return reply.code(400).send(apiError.toResponse())
    }
    // Неразбираемое тело (пустое, не JSON) — тоже ошибка проверки запроса.
    if (statusCode === 400) {
      return reply
        .code(400)
        .send(new ApiError(400, 'VALIDATION_ERROR', message).toResponse())
    }
    throw error
  })
}
