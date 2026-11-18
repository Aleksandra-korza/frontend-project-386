# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Проект

«Календарь звонков» — учебный проект Hexlet: упрощённый сервис бронирования встреч по мотивам Cal.com. Владелец в `/admin` (без авторизации) создаёт типы встреч, гость выбирает тип, дату и свободный слот и бронирует. Требования — `docs/requirements.md` (правила BR/FR/AC с метками источников), исходное ТЗ — `docs/task.md`, обоснование стека — `docs/stack-research.md`, макеты — `docs/reference/`. Сейчас реализован только каркас; функциональности бронирования ещё нет.

Ключевые ограничения из требований, влияющие на код: данные хранятся в памяти процесса (без БД), часовой пояс `Europe/Warsaw`, запрет пересечений бронирований проверяется на сервере (в т. ч. при одновременных запросах). Планируемый контракт API: TypeSpec → OpenAPI → сгенерированный клиентский SDK для frontend.

## Команды

Инструменты и версии (Node.js 24, pnpm 12.21.0, hk, pitchfork) задаёт `mise.toml`. mise в shell не активирован — запускайте через `mise run …` / `mise exec -- …`.

```sh
mise run install        # pnpm install --frozen-lockfile + Git-хуки (hk install --mise)
mise run install-deps   # только зависимости (так делает CI)
mise run check          # pnpm lint → format:check → typecheck → test, до первой ошибки
mise run build          # сборка backend и frontend
mise run dev-backend    # Fastify на 127.0.0.1:4000 (node --watch)
mise run dev-frontend   # Vite на localhost:5173, /api проксируется на 127.0.0.1:4000
mise daemons start|stop|restart|status|logs   # те же dev-серверы в фоне (pitchfork)
```

Отдельные проверки (корневые скрипты `package.json`): `pnpm lint`, `pnpm format` / `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:watch`.

Один тест или один пакет (Vitest projects, `vitest.config.ts` → `apps/*`):

```sh
mise exec -- pnpm exec vitest run apps/backend/src/app.test.ts
mise exec -- pnpm exec vitest run -t "api/health"
mise exec -- pnpm test --project @calendar/backend
```

## Архитектура

pnpm-монорепозиторий (`pnpm-workspace.yaml` → `apps/*`), пакеты `@calendar/backend` и `@calendar/frontend`. Vitest, ESLint, Prettier и commitlint установлены в корне и работают на весь репозиторий.

**Backend (`apps/backend`)** — Fastify 5, ESM, TypeScript без сборщика:
- `src/app.ts` экспортирует фабрику `buildApp()`, `src/server.ts` только слушает порт (`PORT`, `HOST`). Тесты используют `buildApp()` + `app.inject()` без открытия порта.
- В разработке Node 24 запускает `.ts` напрямую (type stripping), поэтому: импорты с расширением `.ts`, `erasableSyntaxOnly` (без enum/namespace/parameter properties), `verbatimModuleSyntax`.
- `tsconfig.json` — проверка типов всего `src` вместе с тестами (`noEmit`); `tsconfig.build.json` — сборка в `dist/` без `*.test.ts` (`rewriteRelativeImportExtensions`).
- Все маршруты — под префиксом `/api` (на этом построены прокси Vite и будущая раздача статики).

**Frontend (`apps/frontend`)** — React 19 + Vite 8, Tailwind CSS 4 через `@tailwindcss/vite` (без `tailwind.config`), shadcn/ui (`components.json`: Radix, стиль radix-nova, базовый цвет neutral, шрифт Geist; компоненты добавляются `pnpm dlx shadcn@latest add …` из `apps/frontend`). Алиас `@/*` → `src/*` задан через `paths` в tsconfig (без `baseUrl`) и `resolve.alias` в `vite.config.ts`.

**TypeScript 6 и 7 одновременно.** Приложения используют TypeScript 7 (`tsc` для typecheck и build). typescript-eslint не поддерживает API TS 7, поэтому в корневом `package.json` `typescript` — алиас на `@typescript/typescript6`, он нужен только ESLint. ESLint (`eslint.config.js`) использует `recommendedTypeChecked` с `projectService`. Не заменяйте алиас и не поднимайте TS в корне.

**Проверки качества — одна система:**
- `mise.toml` — источник команд; Git-хуки и CI вызывают те же задачи, команды не дублируются.
- hk (`hk.pkl`): pre-commit — ESLint и Prettier только по staged-файлам с автоисправлением; commit-msg — commitlint; pre-push — `mise run check`.
- `HK_STASH_UNTRACKED=0` в `[env]` `mise.toml` обязателен: иначе hk на время pre-commit прячет неотслеживаемые файлы в stash.
- Сообщения коммитов — Conventional Commits (`commitlint.config.js`, `@commitlint/config-conventional`).
- CI — `.github/workflows/check.yml`: `mise run install-deps`, `check`, `build`, затем commitlint только по коммитам текущего push (старая история не соответствует Conventional Commits). Сторонние actions закреплены полными SHA.

**Prettier** не форматирует существующую документацию (`docs/task.md`, `docs/requirements.md`, `docs/stack-research.md`) и Markdown в корне (`/*.md`) — см. `.prettierignore`. Не запускайте форматирование этих файлов.

## Правила репозитория

- `.github/workflows/hexlet-check.yml` — служебный workflow Hexlet: не изменять, не удалять, не переименовывать.
- `мой_документ.md` в корне — личный неотслеживаемый файл: не изменять и не добавлять в Git. git выводит его имя экранированным (`"\320\274…"`), поэтому фильтры по имени без `-c core.quotepath=false` его не находят — добавляйте файлы в индекс явными путями.
- Порты фиксированы: backend 4000 (не 3000), frontend 5173 (daemon запускает Vite со `--strictPort`).
