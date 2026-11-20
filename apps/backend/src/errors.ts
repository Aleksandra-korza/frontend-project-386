import type { FastifyInstance } from 'fastify'
import type { ErrorCode, ErrorResponse, FieldError } from './generated/index.ts'

// Ошибки API с единым телом { code, message, fieldErrors? } (docs/specs/booking.md §5).
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
    if (fieldErrors) this.fieldErrors = fieldErrors
  }
}

export const meetingTypeNotFound = (id: string) =>
  new ApiError(404, 'MEETING_TYPE_NOT_FOUND', `Meeting type "${id}" not found`)

/** Ответ на ApiError; остальные ошибки — обработчик Fastify по умолчанию. */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (!(error instanceof ApiError)) throw error
    const body: ErrorResponse = {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
    }
    return reply.status(error.statusCode).send(body)
  })
}
