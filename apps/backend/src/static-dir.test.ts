import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { resolveStaticDir } from './static-dir.ts'

describe('выбор каталога статики', () => {
  let defaultDir: string
  let explicitDir: string

  beforeAll(async () => {
    defaultDir = await mkdtemp(path.join(tmpdir(), 'frontend-dist-'))
    explicitDir = await mkdtemp(path.join(tmpdir(), 'static-dir-'))
  })

  afterAll(async () => {
    await rm(defaultDir, { recursive: true, force: true })
    await rm(explicitDir, { recursive: true, force: true })
  })

  test('явно заданный STATIC_DIR имеет приоритет в любом режиме', () => {
    for (const nodeEnv of ['production', 'development', undefined]) {
      expect(
        resolveStaticDir({ nodeEnv, staticDirEnv: explicitDir, defaultDir }),
      ).toBe(explicitDir)
    }
  })

  test('в production без STATIC_DIR — собранный frontend', () => {
    expect(
      resolveStaticDir({ nodeEnv: 'production', staticDirEnv: '', defaultDir }),
    ).toBe(defaultDir)
  })

  test('в production без собранного frontend — статики нет', () => {
    expect(
      resolveStaticDir({
        nodeEnv: 'production',
        defaultDir: path.join(defaultDir, 'missing'),
      }),
    ).toBeUndefined()
  })

  test('в dev, тестах и без NODE_ENV — статики нет, даже если frontend собран', () => {
    for (const nodeEnv of ['development', 'test', undefined]) {
      expect(resolveStaticDir({ nodeEnv, defaultDir })).toBeUndefined()
    }
  })
})
