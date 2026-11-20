# Исследование: браузерный сценарий с настоящим сервером

Тикет: [#11 «Инструмент браузерного сценария с настоящим сервером»](https://github.com/Aleksandra-korza/frontend-project-386/issues/11). Дата проверки фактов: 2026-11-20. Документ содержит только анализ и рекомендации. Код, конфиги и workflow он не меняет.

## Вопрос

Каким инструментом и как запускать браузерный end-to-end сценарий против **настоящего** приложения (backend Fastify 5 на `127.0.0.1:4000` и frontend Vite 8 + React 19 на `localhost:5173`, где `/api` проксируется на backend) локально и в GitHub Actions (`.github/workflows/check.yml`)?

Кандидаты: Playwright Test (`@playwright/test`), Vitest browser mode (провайдер `@vitest/browser-playwright`), Cypress.

Критерии из тикета: поддержка настоящего сервера, простота CI, время прогона, совместимость со стеком (Node 24, pnpm 12, mise, TypeScript 7, ESLint на TS 6), рекомендации официальной документации.

## Кратко (рекомендация)

**Playwright Test 1.65.1** в отдельном workspace-пакете `e2e/`. Пакет лежит вне `apps/*`, поэтому Vitest его не видит.

- Оба сервера поднимает сам Playwright: `webServer` принимает массив процессов, для каждого задаётся `url` проверки готовности. Для backend это `http://127.0.0.1:4000/api/health`, для frontend `http://localhost:5173/`. Локально с `reuseExistingServer: !process.env.CI` переиспользуются уже запущенные `mise daemons`.
- В CI сценарий идёт против production-сборки: `mise run build`, затем backend `node dist/server.js` и frontend `vite preview --port 5173 --strictPort`. Для `vite preview` прокси по умолчанию берётся из `server.proxy`, поэтому `/api` работает без правок `vite.config.ts`.
- Браузеры ставятся командой `pnpm exec playwright install --with-deps chromium`. Кешировать их Playwright не рекомендует. У npm-пакетов Playwright нет install-скриптов, поэтому для pnpm 12 ничего одобрять (`allowBuilds`) не нужно.
- E2E запускается отдельной задачей mise (например, `mise run e2e`) и отдельным job в `check.yml`. В `mise run check` (pre-push) его включать не стоит, иначе каждый push потребует установленных браузеров.
- Vitest browser mode предназначен для компонентных тестов в браузере. Документация Vitest прямо говорит, что он не заменяет E2E-раннеры. Cypress работает, но его postinstall скачивает бинарник, что требует одобрения сборки в pnpm. Кроме того, официальная GitHub Action Cypress запускает один сервер.

Решение принимает человек. Ниже описаны варианты и компромиссы.

## Варианты

| Критерий                                  | Playwright Test                                                                           | Vitest browser mode (Playwright)                                                | Cypress                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Последняя версия (npm)                    | `@playwright/test` 1.65.1, 2026-11-13                                                     | `vitest` / `@vitest/browser-playwright` 5.1.1, 2026-11-18                       | `cypress` 16.3.0, 2026-11-10 (ветка 15.x: 15.21.2, 2026-11-13)              |
| Node                                      | `engines: >=20`; документация: «latest 22.x, 24.x or 26.x»; Node 20 с 1.65 не тестируется | `engines: ^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`                                  | `engines: ^22.0.0 \|\| ^24.0.0 \|\| >=26.0.0`                               |
| Назначение                                | E2E: тест управляет браузером и открывает любые URL                                       | Тесты внутри браузера на собственном Vite-сервере Vitest, в основном компоненты | E2E, тест работает внутри браузера                                          |
| Настоящий сервер (два процесса)           | Встроено: `webServer: [...]` с проверкой `url`                                            | Не предусмотрено: тесты отдаёт Vite-сервер Vitest                               | В Action параметр `start`, документация показывает один сервер              |
| Установка браузеров                       | `playwright install [--with-deps] [chromium]`                                             | Та же: провайдер использует браузеры Playwright                                 | postinstall скачивает бинарник Cypress; браузеры берутся из системы/раннера |
| pnpm 12: одобрение build-скриптов         | Не нужно: у `playwright`, `playwright-core`, `@playwright/test` нет install-скриптов      | Не нужно                                                                        | Нужно: `allowBuilds` для `cypress` и `side-effects-cache false`             |
| TypeScript                                | Транспилирует сам, типы не проверяет                                                      | Через Vite (как остальные тесты Vitest)                                         | Через свой бандлер                                                          |
| Пересечение с Vitest                      | Шаблон `*.spec.ts` совпадает с include Vitest, поэтому нужна отдельная папка вне `apps/*` | Становится ещё одним проектом Vitest                                            | Свои шаблоны `cypress/e2e/**`                                               |
| Официальная инструкция для GitHub Actions | Есть, пример workflow в документации                                                      | Только общие замечания про headless в CI                                        | Есть, `cypress-io/github-action`                                            |

Источники версий: `npm view <pkg> version engines scripts time` (2026-11-20).

## Установка и запуск

### Playwright Test (рекомендуемый вариант)

1. Пакет. Workspace-пакет `e2e/` (имя, например, `@calendar/e2e`) со своим `package.json`: `@playwright/test` и `typescript ~7.0.2` в devDependencies, скрипты `test` и `typecheck`. В `pnpm-workspace.yaml` к `apps/*` добавляется `e2e`. Так `pnpm -r typecheck` проверит сценарии компилятором TS 7, а корневой алиас TS 6 для ESLint останется нетронутым.
2. Браузеры. Отдельная команда, а не побочный эффект `pnpm install`: «Each version of Playwright needs specific versions of browser binaries to operate». Варианты:
   - `pnpm exec playwright install chromium` локально на macOS;
   - `pnpm exec playwright install --with-deps chromium` в Linux/CI, вместе с системными зависимостями;
   - `--only-shell` скачивает только headless shell Chromium без полного браузера. Подходит для CI, где нужен только headless.
3. Кеш браузеров: `~/Library/Caches/ms-playwright` (macOS), `~/.cache/ms-playwright` (Linux). Путь меняется через `PLAYWRIGHT_BROWSERS_PATH`. Ненужные версии Playwright удаляет сам (GC).
4. mise. В реестре mise есть `playwright` → `npm:playwright`, но так ставится только CLI, а не браузеры. Версия CLI при этом может разойтись с `@playwright/test` из lockfile. Поэтому версию держит `pnpm-lock.yaml`, а mise даёт задачи, например:
   - `e2e-install`: `pnpm --filter @calendar/e2e exec playwright install --with-deps chromium`;
   - `e2e`: `pnpm --filter @calendar/e2e test`.
5. Конфиг `e2e/playwright.config.ts` по образцу из документации: `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 2 : 0`, `workers: process.env.CI ? 1 : undefined`, `use.trace: 'on-first-retry'`, `use.baseURL: 'http://localhost:5173'`. По умолчанию Playwright ищет `**/*.@(spec|test).?(c|m)[jt]s?(x)` внутри `testDir`.

### Vitest browser mode

Пакеты `@vitest/browser-playwright` (peer: `vitest 5.1.1`, `playwright *`) и браузеры Playwright. В конфиге задаются `browser.enabled: true`, `provider: playwright()` и `instances: [{ browser: 'chromium' }]`. Тесты исполняются на Vite-сервере самого Vitest. Сценарий «открыть приложение на 5173, пройти путь гостя» сюда ложится плохо.

### Cypress

`pnpm add -D cypress` сработает только после разрешения сборки: у пакета есть `postinstall: node dist/index.js --exec install`, а pnpm по умолчанию блокирует неодобренные скрипты и с `strictDepBuilds: true` завершает установку с ошибкой. Документация Cypress дополнительно требует отключить `side-effects-cache` в pnpm. Для Linux нужен набор системных пакетов (`libgtk-3-0`, `libnss3`, `xvfb` и др.).

## Запуск настоящего сервера

Playwright `webServer` поддерживает:

- массив серверов, у каждого свои `command`, `url`, `name`, `timeout`, `reuseExistingServer`;
- готовность по `url`: ответ 2xx, 3xx, 400, 401, 402 или 403. Опция `port` устарела;
- `timeout` 60 000 мс по умолчанию; `cwd` по умолчанию равен папке конфига; `env` по умолчанию `process.env` плюс `PLAYWRIGHT_TEST=1`;
- без `gracefulShutdown` группа процессов завершается `SIGKILL`.

Набросок для проекта (не код для коммита, а форма решения):

```ts
// e2e/playwright.config.ts (набросок)
const ci = !!process.env.CI
export default defineConfig({
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    {
      name: 'backend',
      cwd: '..',
      command: ci
        ? 'pnpm --filter @calendar/backend start' // node dist/server.js
        : 'pnpm dev:backend',
      url: 'http://127.0.0.1:4000/api/health',
      reuseExistingServer: !ci,
    },
    {
      name: 'frontend',
      cwd: '..',
      command: ci
        ? 'pnpm --filter @calendar/frontend preview --port 5173 --strictPort'
        : 'pnpm dev:frontend --strictPort',
      url: 'http://localhost:5173/',
      reuseExistingServer: !ci,
    },
  ],
})
```

### Dev-сервер или production-сборка

| Режим                                  | Плюсы                                                                                                                      | Минусы                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `vite` (dev), `node --watch`           | Ничего не нужно собирать. Совпадает с `mise daemons`, локально можно переиспользовать запущенные серверы                   | Проверяется не то, что поставляется. Первая загрузка медленнее из-за трансформации модулей                          |
| `vite preview` + `node dist/server.js` | Проверяется реальная сборка. `check.yml` уже выполняет `mise run build`. `preview.proxy` по умолчанию равен `server.proxy` | Нужен шаг сборки. Порт preview по умолчанию 4173, поэтому порт 5173 надо передать явно (`--port 5173 --strictPort`) |

Рекомендация: в CI production-сборка, локально dev через `reuseExistingServer`. `preview.strictPort` по умолчанию наследует `server.strictPort`, а в проекте `--strictPort` передаётся флагом, поэтому для preview флаг тоже нужен.

Готовность повторяет проверки `[daemons.*].ready_http` из `mise.toml`: те же URL `127.0.0.1:4000/api/health` и `localhost:5173/`. Порты 4000 и 5173 фиксированы (AGENTS.md).

## CI (GitHub Actions)

Официальный пример Playwright: `checkout` → `setup-node` (`lts/*`) → `npm ci` → `npx playwright install --with-deps` → `npx playwright test` → `actions/upload-artifact` с `if: ${{ !cancelled() }}`, `path: playwright-report/`, `retention-days: 30`.

Перенос на этот проект (`check.yml`; `hexlet-check.yml` не трогаем):

- отдельный job `e2e` (параллельно `check`) или шаги после `Build` в существующем job. Отдельный job не задерживает остальные проверки и падает отдельно;
- шаги: checkout → `jdx/mise-action` (как в `check`) → `mise run install-deps` → `mise run build` → `mise run e2e-install` → `mise run e2e` → upload `playwright-report/` при `!cancelled()`;
- Node берётся из `mise.toml` (24), а не `lts/*`. Node 24 входит в поддерживаемые Playwright версии;
- кеш браузеров не нужен: «Caching browser binaries is not recommended», восстановление занимает примерно столько же, сколько скачивание, а системные зависимости Linux закешировать нельзя;
- `workers: 1` в CI («to prioritize stability and reproducibility»), `globalTimeout` в конфиге и `timeout-minutes` у job с запасом;
- альтернатива: контейнер `mcr.microsoft.com/playwright:v<версия>-noble` с готовыми зависимостями. С 1.65 в образах Node 26, а не 24, что расходится с `mise.toml`. Поэтому лучше обычный `ubuntu-latest` + `--with-deps`.

**Длительность (оценка, не измерение):** установка Chromium с зависимостями обычно занимает порядка минуты, один сценарий на двух уже собранных серверах выполняется за секунды, плюс сборка, которая и так есть в `check`. Итог job, вероятно, 2–4 минуты. Точную цифру даст первый прогон. Официальных цифр в документации нет.

## Сосуществование с Vitest

- Корневой `vitest.config.ts` задаёт `projects: ['apps/*']`. Каждая папка, подходящая под glob, считается проектом даже без конфига, а корневой конфиг без явного указания проектом не является.
- Include Vitest по умолчанию `**/*.{test,spec}.?(c|m)[jt]s?(x)`, exclude `['**/node_modules/**', '**/.git/**']`. Файл `*.spec.ts` внутри `apps/*` Vitest попытается выполнить как свой тест и упадёт на импорте `@playwright/test`.
- Поэтому сценарии нельзя класть в `apps/*` (ни в `apps/frontend/e2e/`, ни в `apps/e2e/`). Папка `e2e/` в корне workspace не попадает ни в один проект Vitest, и менять `vitest.config.ts` не нужно. Если всё же нужна папка в `apps/`, придётся добавить исключение в Vitest (`exclude` во frontend-проекте или явный список проектов).
- Playwright, наоборот, ищет тесты только в своём `testDir`, поэтому `*.test.ts` из `apps/*` он не тронет.
- ESLint: `projectService` найдёт ближайший `e2e/tsconfig.json`. Корневой `allowDefaultProject: ['*.ts']` покрывает только файлы в корне. Глобальные переменные Node для `e2e/**` можно задать отдельным блоком, как `project/backend`. Prettier уже форматирует новые файлы.
- TypeScript: Playwright «does not check the types and will run tests even if there are non-critical TypeScript compilation errors» и рекомендует запускать `tsc` отдельно. Это даст `typecheck` пакета `e2e` (TS 7) внутри `pnpm -r typecheck`. Из `tsconfig` Playwright учитывает подмножество опций (`paths`, `baseUrl`, `jsx*`, `references`, `extends`, `useDefineForClassFields` и др.). С 1.65 поля классов следуют `useDefineForClassFields`, с 1.64 JSX следует `tsconfig`. API компилятора TypeScript Playwright не использует, поэтому отсутствие API в TS 7 ему не мешает.

## Риски

- **Браузеры не входят в `pnpm install`.** Нужна явная задача `e2e-install`. Если её забыть, локальный и CI-прогоны упадут с понятной ошибкой Playwright.
- **`localhost` и `127.0.0.1`.** Backend слушает только `127.0.0.1`. Vite dev слушает `localhost`, что на некоторых системах означает `::1`. URL проверок надо брать ровно как в `mise.toml`.
- **`reuseExistingServer` локально.** Если запущены старые daemons, тест пройдёт против них. Это удобно, но версия сервера может не совпасть с кодом.
- **Состояние backend.** Если сценарий создаёт бронирования, тестам нужна изоляция: свежий процесс на прогон в CI, а локально перезапуск daemons или отдельный порт/данные.
- **Несоответствие версий.** Браузеры привязаны к версии Playwright, поэтому обновлять `@playwright/test` нужно вместе с `playwright install` (CI делает это каждый прогон).
- **Pre-push.** Добавлять e2e в `mise run check` не следует: hook станет медленным и будет требовать браузеры.
- **Cypress и pnpm.** Если выбрать Cypress, придётся править `pnpm-workspace.yaml` (`allowBuilds`) и кеш side effects, а для двух серверов придумать запуск вне `cypress-io/github-action` или через одну команду.
- **Vitest browser mode** не закрывает требование «настоящий сервер». Это дополнение для компонентов, а не замена.

## Источники

- Тикет: https://github.com/Aleksandra-korza/frontend-project-386/issues/11
- npm registry (2026-11-20): `npm view @playwright/test`, `playwright`, `playwright-core`, `cypress`, `vitest`, `@vitest/browser`, `@vitest/browser-playwright` (`version`, `engines`, `scripts`, `peerDependencies`, `time`)
- Playwright, установка и системные требования: https://playwright.dev/docs/intro
- Playwright, webServer: https://playwright.dev/docs/test-webserver
- Playwright, браузеры, `--with-deps`, `--only-shell`, кеш, GC: https://playwright.dev/docs/browsers
- Playwright, CI, кеширование, workers, контейнер: https://playwright.dev/docs/ci
- Playwright, GitHub Actions workflow: https://playwright.dev/docs/ci-intro
- Playwright, TypeScript: https://playwright.dev/docs/test-typescript
- Playwright, конфигурация и testMatch: https://playwright.dev/docs/test-configuration
- Playwright, release notes 1.63–1.65: https://playwright.dev/docs/release-notes
- Vitest browser mode: https://vitest.dev/guide/browser/ и https://vitest.dev/guide/browser/why
- Vitest include/exclude: https://vitest.dev/config/include, https://vitest.dev/config/exclude
- Vitest projects: https://vitest.dev/guide/projects
- Vite preview options (`preview.proxy`, `preview.port`, `preview.strictPort`): https://vite.dev/config/preview-options
- pnpm build settings (`allowBuilds`, `strictDepBuilds`): https://pnpm.io/settings/build
- Cypress, установка, pnpm, Linux: https://docs.cypress.io/app/get-started/install-cypress
- Cypress, GitHub Actions: https://docs.cypress.io/app/continuous-integration/github-actions
- mise registry `playwright`: https://github.com/jdx/mise/blob/main/registry/playwright.toml
- Проект: `AGENTS.md`, `mise.toml`, `.github/workflows/check.yml`, `vitest.config.ts`, `apps/frontend/vite.config.ts`, `eslint.config.js`, `pnpm-workspace.yaml`
