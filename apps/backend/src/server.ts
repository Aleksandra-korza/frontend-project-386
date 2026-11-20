import path from 'node:path'
import { buildApp } from './app.ts'
import { registerShutdown } from './shutdown.ts'
import { resolveStaticDir } from './static-dir.ts'

const port = Number(process.env.PORT ?? 4000)
const host = process.env.HOST ?? '127.0.0.1'

const app = buildApp({
  logger: true,
  staticDir: resolveStaticDir({
    nodeEnv: process.env.NODE_ENV,
    staticDirEnv: process.env.STATIC_DIR,
    defaultDir: path.join(import.meta.dirname, '../../frontend/dist'),
  }),
})

registerShutdown(app, process)

try {
  await app.listen({ port, host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
