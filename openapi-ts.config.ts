// OpenAPI → TypeScript SDK для frontend. Документация: https://heyapi.dev/openapi-ts/get-started
// Запускается из корня: генератору нужен API TypeScript 6 (корневой `typescript`).
import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './api/generated/openapi.json',
  output: 'apps/frontend/src/client',
  plugins: ['@hey-api/client-fetch'],
})
