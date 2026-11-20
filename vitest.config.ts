import { defineConfig } from 'vitest/config'

// Единая точка запуска тестов монорепозитория.
// Каждый пакет в apps/* — отдельный проект Vitest (https://vitest.dev/guide/projects).
export default defineConfig({
  test: {
    projects: ['apps/*'],
  },
})
