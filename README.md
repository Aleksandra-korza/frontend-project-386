# Календарь звонков


[![hexlet-check](https://github.com/Aleksandra-korza/frontend-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/Aleksandra-korza/frontend-project-386/actions)

Разработайте совместно с ИИ сервис для бронирования календаря

Учебный проект Хекслета: https://ru.hexlet.io/programs/frontend
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Сценарий работы

1. Владелец открывает раздел `/admin` и создаёт тип встречи: название, описание (необязательно) и длительность.
2. Гость без регистрации открывает каталог типов встреч и выбирает подходящий тип.
3. Гость выбирает доступную дату с завтрашнего дня на 14 календарных дней и свободное время.
4. Гость вводит имя и email и подтверждает бронирование.
5. Система на сервере проверяет, что время не занято и не пересекается с другими встречами, создаёт запись и показывает подтверждение.
6. Владелец открывает `/admin` и видит новую запись в списке предстоящих встреч.

Подробные требования — в [docs/requirements.md](docs/requirements.md).

## Статус

Готов каркас приложения: backend и frontend, контракт API, проверки качества и CI. Функциональность бронирования ещё не реализована — она появится на следующих этапах.

По принятым решениям ([docs/requirements.md](docs/requirements.md)):

- данные будут храниться в памяти процесса и сбрасываться при перезапуске;
- раздел `/admin` не защищён авторизацией.

## Стек

- **Monorepo:** pnpm workspaces (`apps/backend`, `apps/frontend`), Node.js 24, TypeScript 7.
- **Backend:** Fastify 5.
- **Frontend:** React 19, Vite 8, Tailwind CSS 4, shadcn/ui.
- **API:** контракт на TypeSpec (`api/main.tsp`) → OpenAPI 3.0 (`api/generated/openapi.json`) → TypeScript SDK для frontend и типы для backend (`@hey-api/openapi-ts`, `apps/frontend/src/client`, `apps/backend/src/generated`).
- **Качество:** Vitest, ESLint, Prettier, проверка типов `tsc`.
- **Инструменты:** [mise](https://mise.jdx.dev/) — версии инструментов, задачи и фоновые процессы (daemons через pitchfork); Git-хуки [hk](https://hk.jdx.dev/); commitlint (Conventional Commits); GitHub Actions.

## Установка

Нужны Git и [mise](https://mise.jdx.dev/getting-started.html). Node.js, pnpm и остальные инструменты mise установит сам по `mise.toml`.

```bash
git clone https://github.com/Aleksandra-korza/frontend-project-386.git
cd frontend-project-386
mise trust          # разрешить mise использовать mise.toml проекта
mise run install    # зависимости (pnpm install --frozen-lockfile) и Git-хуки
```

Активировать mise в shell не обязательно: команды запускаются через `mise run …`.

## Использование

### Запуск в режиме разработки

```bash
mise run dev-backend    # backend: http://127.0.0.1:4000
mise run dev-frontend   # frontend: http://localhost:5173
```

Или оба сервера в фоне:

```bash
mise daemons start      # запустить backend, затем frontend
mise daemons status     # состояние и порты
mise daemons logs backend
mise daemons stop       # остановить
```

Откройте http://localhost:5173 — на странице отображается «API: доступен». Frontend обращается к backend через сгенерированный SDK; в режиме разработки Vite проксирует `/api` на порт 4000. Проверить backend напрямую:

```bash
curl http://127.0.0.1:4000/api/health   # {"status":"ok"}
```

### Проверки и сборка

```bash
mise run check      # ESLint, Prettier, проверка типов и тесты
mise run build      # сборка backend и frontend
mise run e2e        # браузерные сценарии (Playwright, Chromium)
```

### Изменение API

API описывается в `api/main.tsp`. После изменения контракта перегенерируйте OpenAPI и SDK и закоммитьте результат — CI проверяет, что сгенерированный код актуален:

```bash
mise run codegen
```

### Коммиты

Сообщения коммитов — [Conventional Commits](https://www.conventionalcommits.org/), например `feat: add booking calendar`. Git-хуки проверяют код перед коммитом, сообщение коммита и запускают `mise run check` перед push.

Инструкции для AI-агентов — в [AGENTS.md](AGENTS.md).

<!-- Добавьте запись asciinema — именно это смотрит работодатель -->

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
