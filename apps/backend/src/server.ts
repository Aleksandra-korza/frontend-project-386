import { existsSync } from 'node:fs'
import path from 'node:path'
import { buildApp } from './app.ts'

const port = Number(process.env.PORT ?? 4000)
const host = process.env.HOST ?? '127.0.0.1'

// Собранный frontend: apps/frontend/dist рядом с apps/backend/dist
// (переопределяется STATIC_DIR); раздаётся, только если каталог существует.
const staticDir = path.resolve(
  process.env.STATIC_DIR ||
    path.join(import.meta.dirname, '../../frontend/dist'),
)

const app = buildApp({
  logger: true,
  staticDir: existsSync(staticDir) ? staticDir : undefined,
})

try {
  await app.listen({ port, host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
