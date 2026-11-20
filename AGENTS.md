# AGENTS.md

Инструкции для AI-агентов, работающих с репозиторием «Календарь звонков» (учебный проект Hexlet: сервис бронирования встреч). Требования — `docs/requirements.md`, исходное ТЗ — `docs/task.md`.

## Структура

pnpm-монорепозиторий (`apps/*`):

- `apps/backend` — API на Fastify + TypeScript, все маршруты под `/api`. Фабрика приложения `src/app.ts` (`buildApp()`), запуск сервера `src/server.ts`.
- `apps/frontend` — React + Vite + TypeScript, Tailwind CSS 4, shadcn/ui. В dev-режиме `/api` проксируется на backend.
- `api/` — контракт API на TypeSpec (`main.tsp`). Из него генерируются OpenAPI (`api/generated/openapi.json`), клиентский SDK frontend (`apps/frontend/src/client`) и типы backend (`apps/backend/src/generated`), генератор `@hey-api/openapi-ts`.
- `docs/` — требования (`requirements.md`), ТЗ (`task.md`), исследование стека, макеты (`reference/`), спецификации фич (`specs/`), архитектурные решения (`adr/`) и открытые вопросы следующих этапов (`open-questions.md`).
- `GLOSSARY.md` — словарь терминов предметной области; используйте его термины в коде, задачах и документах.

## Окружение и установка

Версии Node.js, pnpm и инструментов заданы в `mise.toml`. mise не активирован в shell — запускайте команды через `mise run <задача>` или `mise exec -- <команда>`.

```sh
mise run install        # зависимости (pnpm install --frozen-lockfile) и Git-хуки hk
```

## Запуск

```sh
mise run dev-backend    # backend: http://127.0.0.1:4000 (проверка: /api/health)
mise run dev-frontend   # frontend: http://localhost:5173
```

Те же серверы в фоне (mise daemons + pitchfork):

```sh
mise daemons start      # backend, затем frontend
mise daemons status     # состояние, PID, порты
mise daemons logs backend
mise daemons restart
mise daemons stop
```

## Проверки и сборка

```sh
mise run codegen        # TypeSpec → OpenAPI → SDK frontend
mise run check          # pnpm lint → format:check → typecheck → test (до первой ошибки)
mise run build          # сборка backend и frontend
```

API меняется через `api/main.tsp`, затем `mise run codegen`. Файлы в `api/generated/`, `apps/frontend/src/client/` и `apps/backend/src/generated/` генерируются и хранятся в Git — не редактируйте их вручную; CI проверяет, что после `mise run codegen` в них нет изменений. Backend регистрирует маршруты вручную со схемами из `openapi.json` (`apps/backend/src/contract.ts`, ADR-0005), соответствие контракту проверяет `apps/backend/src/contract.test.ts`.

Отдельно: `pnpm lint`, `pnpm format`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:watch` (через `mise exec --`). Один тест или пакет:

```sh
mise exec -- pnpm exec vitest run apps/backend/src/app.test.ts
mise exec -- pnpm test --project @calendar/backend
```

Изменение считается готовым, когда `mise run check` и `mise run build` проходят. CI (`.github/workflows/check.yml`) запускает те же задачи.

## Коммиты

Сообщения коммитов — [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`, например `feat: add booking calendar`, `fix: handle empty slots`. Правила — `commitlint.config.js` (`@commitlint/config-conventional`); их проверяют Git-хук `commit-msg` и CI. Хук `pre-push` запускает `mise run check`.

## Ограничения

- `.github/workflows/hexlet-check.yml` — служебный workflow Hexlet: не изменять, не удалять, не переименовывать.
- В корне могут быть личные неотслеживаемые файлы: не добавлять их в Git. Добавляйте в индекс явные пути, не `git add .` / `git add -A`.
- Порты фиксированы: backend 4000, frontend 5173.
- В корневом `package.json` пакет `typescript` — алиас на TypeScript 6 только для ESLint (typescript-eslint не поддерживает TS 7); приложения собираются TypeScript 7. Не менять.

## Agent skills

### Issue tracker

Задачи и спецификации ведутся в GitHub Issues репозитория (CLI `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Пять канонических триаж-меток по умолчанию: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: один `GLOSSARY.md` и `docs/adr/` в корне (создаются по мере необходимости). See `docs/agents/domain.md`.
