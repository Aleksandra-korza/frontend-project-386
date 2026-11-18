# AGENTS.md

Инструкции для AI-агентов, работающих с репозиторием «Календарь звонков» (учебный проект Hexlet: сервис бронирования встреч). Требования — `docs/requirements.md`, исходное ТЗ — `docs/task.md`.

## Структура

pnpm-монорепозиторий (`apps/*`):

- `apps/backend` — API на Fastify + TypeScript, все маршруты под `/api`. Фабрика приложения `src/app.ts` (`buildApp()`), запуск сервера `src/server.ts`.
- `apps/frontend` — React + Vite + TypeScript, Tailwind CSS 4, shadcn/ui. В dev-режиме `/api` проксируется на backend.
- `docs/` — требования, ТЗ, исследование стека, макеты.

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
mise run check          # pnpm lint → format:check → typecheck → test (до первой ошибки)
mise run build          # сборка backend и frontend
```

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
