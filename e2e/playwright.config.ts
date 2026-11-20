import { defineConfig, devices } from '@playwright/test'
import { BACKEND_URL, FRONTEND_URL } from './tests/servers.ts'

// Браузерные сценарии на настоящих серверах (docs/specs/booking.md §7).
// Порты фиксированы (AGENTS.md): backend 4000, frontend 5173. Серверы запускает
// и останавливает Playwright; если порт уже занят, прогон завершается ошибкой —
// чужой процесс не переиспользуется.
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests',
  // Календарь владельца один на все типы (BR-16): сценарии занимают слоты
  // общего календаря, поэтому выполняются по очереди.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: 0,
  // Отчёт — e2e/playwright-report (в CI загружается при падении).
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'mise exec -- pnpm dev:backend',
      cwd: '..',
      url: `${BACKEND_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      command: 'mise exec -- pnpm dev:frontend --strictPort',
      cwd: '..',
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
  ],
})
