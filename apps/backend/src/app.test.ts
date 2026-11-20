import { afterAll, describe, expect, test } from 'vitest'
import { buildApp } from './app.ts'

describe('backend smoke', () => {
  const app = buildApp()

  afterAll(async () => {
    await app.close()
  })

  test('GET /api/health отвечает 200 и { status: "ok" }', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })
})
