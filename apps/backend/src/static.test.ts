import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { startTestServer } from './testing/http.ts'

const INDEX_HTML = '<!doctype html><title>Календарь звонков</title>'
const ASSET_JS = 'console.log("app")'

describe('без каталога статики', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>

  beforeAll(async () => {
    server = await startTestServer()
  })

  afterAll(async () => {
    await server.close()
  })

  test('неизвестный адрес вне /api — 404, а не index.html', async () => {
    const response = await server.request('/book', {
      headers: { accept: 'text/html' },
    })

    expect(response.status).toBe(404)
  })

  test('/api без маршрута — JSON 404 с единым телом ошибки', async () => {
    const response = await server.request('/api/unknown')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      code: 'NOT_FOUND',
      message: 'Route GET /api/unknown not found',
    })
  })
})

describe('с каталогом статики', () => {
  let staticDir: string
  let server: Awaited<ReturnType<typeof startTestServer>>

  beforeAll(async () => {
    staticDir = await mkdtemp(path.join(tmpdir(), 'calendar-static-'))
    await writeFile(path.join(staticDir, 'index.html'), INDEX_HTML)
    await mkdir(path.join(staticDir, 'assets'))
    await writeFile(path.join(staticDir, 'assets', 'app.js'), ASSET_JS)
    server = await startTestServer({ staticDir })
  })

  afterAll(async () => {
    await server.close()
    await rm(staticDir, { recursive: true, force: true })
  })

  test.each([
    '/',
    '/book',
    '/book/intro-call',
    '/book/intro-call/confirm?startsAt=2026-11-23T10%3A00%3A00%2B03%3A00',
    '/admin',
  ])('%s → index.html', async (url) => {
    const response = await server.request(url, {
      headers: { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^text\/html/)
    expect(await response.text()).toBe(INDEX_HTML)
  })

  test('HEAD клиентского адреса — 200 text/html без тела', async () => {
    const response = await server.request('/book', {
      method: 'HEAD',
      headers: { accept: 'text/html' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^text\/html/)
    expect(await response.text()).toBe('')
  })

  test('файл ассета отдаётся сам с верным content-type', async () => {
    const response = await server.request('/assets/app.js')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(
      /^(text|application)\/javascript/,
    )
    expect(await response.text()).toBe(ASSET_JS)
  })

  test('несуществующий ассет без запроса HTML — 404, а не index.html', async () => {
    const response = await server.request('/assets/missing.js', {
      headers: { accept: '*/*' },
    })

    expect(response.status).toBe(404)
    expect(await response.text()).not.toBe(INDEX_HTML)
  })

  test('/api без маршрута — JSON 404, а не index.html', async () => {
    const response = await server.request('/api/unknown', {
      headers: { accept: 'text/html' },
    })

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toMatch(/^application\/json/)
    expect(await response.json()).toEqual({
      code: 'NOT_FOUND',
      message: 'Route GET /api/unknown not found',
    })
  })

  test('/api/health по-прежнему JSON', async () => {
    const response = await server.request('/api/health', {
      headers: { accept: 'text/html' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  test('POST вне /api — 404, а не index.html', async () => {
    const response = await server.request('/book', {
      method: 'POST',
      headers: { accept: 'text/html' },
    })

    expect(response.status).toBe(404)
    expect(await response.text()).not.toBe(INDEX_HTML)
  })
})
