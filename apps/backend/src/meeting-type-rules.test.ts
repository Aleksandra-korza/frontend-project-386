import { afterAll, describe, expect, test } from 'vitest'
import { buildApp } from './app.ts'

// Правила полей типа встречи (docs/specs/booking.md §2, таблица «Ошибки полей» §5).
// Правила складываются из схемы контракта и проверок кода, поэтому проверяются
// через приложение в процессе (inject), без HTTP-сервера.
const app = buildApp()

afterAll(async () => {
  await app.close()
})

const valid = { id: 'intro-call', title: 'Знакомство', durationMinutes: 30 }
let sequence = 0

// Ошибка указанного поля или undefined, если тип встречи создан.
async function fieldError(field: string, value: unknown) {
  sequence += 1
  const body: Record<string, unknown> = {
    ...valid,
    id: `type-${sequence}`,
    [field]: value,
  }
  if (value === undefined) delete body[field]
  const response = await app.inject({
    method: 'POST',
    url: '/api/meeting-types',
    payload: body,
  })
  if (response.statusCode === 201) return undefined
  const { fieldErrors = [] } = response.json<{
    fieldErrors?: { field: string; code: string }[]
  }>()
  expect(fieldErrors).toHaveLength(1)
  expect(fieldErrors[0]?.field).toBe(field)
  return fieldErrors[0]?.code
}

describe('id', () => {
  test.each([
    ['abc', undefined],
    ['a'.repeat(40), undefined],
    ['intro-call-2', undefined],
    ['ab', 'INVALID_FORMAT'],
    ['a'.repeat(41), 'INVALID_FORMAT'],
    ['Intro-call', 'INVALID_FORMAT'],
    ['intro--call', 'INVALID_FORMAT'],
    ['-intro', 'INVALID_FORMAT'],
    ['intro-', 'INVALID_FORMAT'],
    ['intro call', 'INVALID_FORMAT'],
    ['звонок', 'INVALID_FORMAT'],
    [123, 'INVALID_FORMAT'],
    ['', 'INVALID_FORMAT'],
    [undefined, 'REQUIRED'],
    [null, 'REQUIRED'],
  ])('%j → %s', async (value, code) => {
    expect(await fieldError('id', value)).toBe(code)
  })
})

describe('title', () => {
  test.each([
    ['a', undefined],
    ['н'.repeat(80), undefined],
    [`  ${'н'.repeat(80)}  `, undefined],
    ['н'.repeat(81), 'TOO_LONG'],
    ['', 'REQUIRED'],
    ['   ', 'REQUIRED'],
    [undefined, 'REQUIRED'],
    [null, 'REQUIRED'],
    [42, 'INVALID_FORMAT'],
  ])('%j → %s', async (value, code) => {
    expect(await fieldError('title', value)).toBe(code)
  })
})

describe('description', () => {
  test.each([
    [undefined, undefined],
    [null, undefined],
    ['', undefined],
    ['   ', undefined],
    ['о'.repeat(500), undefined],
    [` ${'о'.repeat(500)} `, undefined],
    ['о'.repeat(501), 'TOO_LONG'],
    [true, 'INVALID_FORMAT'],
  ])('%j → %s', async (value, code) => {
    expect(await fieldError('description', value)).toBe(code)
  })
})

describe('durationMinutes', () => {
  test.each([
    [15, undefined],
    [480, undefined],
    [90, undefined],
    [0, 'OUT_OF_RANGE'],
    [-15, 'OUT_OF_RANGE'],
    [495, 'OUT_OF_RANGE'],
    [20, 'OUT_OF_RANGE'],
    [470, 'OUT_OF_RANGE'],
    [30.5, 'INVALID_FORMAT'],
    ['30', 'INVALID_FORMAT'],
    [undefined, 'REQUIRED'],
    [null, 'REQUIRED'],
  ])('%j → %s', async (value, code) => {
    expect(await fieldError('durationMinutes', value)).toBe(code)
  })
})

test('сохраняет обрезанные значения, пустое описание не сохраняется', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/meeting-types',
    payload: {
      id: 'trimmed',
      title: '  Знакомство ',
      description: '   ',
      durationMinutes: 480,
    },
  })

  expect(response.statusCode).toBe(201)
  expect(response.json()).toEqual({
    id: 'trimmed',
    title: 'Знакомство',
    durationMinutes: 480,
  })
})
