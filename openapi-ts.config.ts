// OpenAPI → TypeScript: SDK для frontend и типы для backend (ADR-0005).
// Документация: https://heyapi.dev/openapi-ts/get-started
// Запускается из корня: генератору нужен API TypeScript 6 (корневой `typescript`).
import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig([
  {
    input: './api/generated/openapi.json',
    output: 'apps/frontend/src/client',
    plugins: ['@hey-api/client-fetch'],
  },
  {
    // Только типы: маршруты backend пишутся вручную, схемы берутся из openapi.json.
    input: './api/generated/openapi.json',
    output: {
      path: 'apps/backend/src/generated',
      // Backend запускается через type stripping Node.js: импорты с расширением .ts.
      module: { extension: '.ts' },
    },
    plugins: ['@hey-api/typescript'],
  },
])
