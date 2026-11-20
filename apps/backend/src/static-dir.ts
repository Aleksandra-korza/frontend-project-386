import { existsSync } from 'node:fs'
import path from 'node:path'

type StaticDirOptions = {
  /** process.env.NODE_ENV */
  nodeEnv?: string
  /** process.env.STATIC_DIR: явный каталог, приоритетнее режима. */
  staticDirEnv?: string
  /** Собранный frontend (apps/frontend/dist рядом с собранным backend). */
  defaultDir: string
}

/**
 * Каталог собранного frontend для раздачи (docs/specs/deploy.md §2):
 * явный STATIC_DIR; иначе в production — defaultDir, если он существует;
 * иначе (dev через Vite, тесты, NODE_ENV не задан) — статики нет.
 */
export function resolveStaticDir({
  nodeEnv,
  staticDirEnv,
  defaultDir,
}: StaticDirOptions): string | undefined {
  if (staticDirEnv) {
    return path.resolve(staticDirEnv)
  }
  if (nodeEnv === 'production' && existsSync(defaultDir)) {
    return path.resolve(defaultDir)
  }
  return undefined
}
