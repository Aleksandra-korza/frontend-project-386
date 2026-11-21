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

Реализован сервис записи: владелец создаёт типы встреч и видит предстоящие бронирования в `/admin`, гость выбирает тип, день и время в `/book` и бронирует слот. Приложение собирается в один Docker-образ и готовится к деплою на Render.

Публичный адрес: _появится после создания сервиса на Render_ <!-- TODO(#31): вписать URL вида https://calendar-calls.onrender.com -->

По принятым решениям ([docs/requirements.md](docs/requirements.md)) данные хранятся только в памяти процесса, а раздел `/admin` не защищён авторизацией — подробнее в разделе [«Ограничения»](#ограничения).

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

### Docker

Production-образ собирается из `Dockerfile` в корне: Fastify в одном процессе отдаёт API (`/api/*`) и собранный frontend, клиентские адреса (`/book`, `/admin`) получают `index.html` ([ADR-0006](docs/adr/0006-single-image-fastify-serves-frontend.md), [docs/specs/deploy.md](docs/specs/deploy.md)). Нужен Docker.

```bash
mise run docker-build   # собрать образ calendar-calls
mise run docker-run     # запустить: http://localhost:4000 (API и frontend); Ctrl+C — остановить
mise run docker-smoke   # собрать и проверить два контейнера: /api/health, /, /book и содержимое образа
```

Без mise — те же команды Docker:

```bash
docker build -t calendar-calls .
docker run --rm --init -p 4000:4000 calendar-calls
curl http://localhost:4000/api/health   # {"status":"ok"}
```

Переменные окружения контейнера:

| Переменная   | По умолчанию в образе | Назначение                                                     |
| ------------ | --------------------- | -------------------------------------------------------------- |
| `PORT`       | `4000`                | порт HTTP-сервера; Render задаёт свой (`10000`)                |
| `HOST`       | `0.0.0.0`             | адрес, на котором слушает сервер (вне Docker — `127.0.0.1`)    |
| `STATIC_DIR` | —                     | каталог собранного frontend, если он не в `apps/frontend/dist` |

Пример с другим портом: `docker run --rm --init -e PORT=10000 -p 10000:10000 calendar-calls`. Секреты и `.env` образу не нужны.

### Коммиты

Сообщения коммитов — [Conventional Commits](https://www.conventionalcommits.org/), например `feat: add booking calendar`. Git-хуки проверяют код перед коммитом, сообщение коммита и запускают `mise run check` перед push.

Инструкции для AI-агентов — в [AGENTS.md](AGENTS.md).

## Деплой на Render

Приложение публикуется как один бесплатный Web Service на [Render](https://render.com/) по Blueprint [`render.yaml`](render.yaml):

| Поле                | Значение      | Зачем                                             |
| ------------------- | ------------- | ------------------------------------------------- |
| `type`              | `web`         | публичный web service                             |
| `runtime`           | `docker`      | сборка из `Dockerfile` в корне                    |
| `plan`              | `free`        | только бесплатный тариф                           |
| `region`            | `frankfurt`   | ближайший регион; после создания не меняется      |
| `branch`            | `main`        | деплой из основной ветки                          |
| `autoDeployTrigger` | `checksPass`  | деплой только после зелёных проверок коммита      |
| `healthCheckPath`   | `/api/health` | готовность по ответу API, а не по открытому порту |

Создание сервиса (один раз, вручную):

1. Войти в [Render Dashboard](https://dashboard.render.com/) и подключить GitHub-репозиторий.
2. **New → Blueprint**, выбрать репозиторий и ветку `main` — Render прочитает `render.yaml` и покажет сервис `calendar-calls` с тарифом **Free**.
3. Применить Blueprint и дождаться первого деплоя. Адрес сервиса — на его странице в Dashboard (вида `https://calendar-calls.onrender.com`).
4. Проверить: `/api/health` отвечает `{"status":"ok"}`, `/book` открывается напрямую и после обновления страницы.

Дальше каждый коммит в `main` деплоится автоматически, но только когда все проверки GitHub для этого коммита прошли успешно: workflow `check` (jobs `check`, `e2e`, `docker`) и `hexlet-check`. Если хоть одна проверка упала, Render этот коммит не деплоит. Пропустить деплой коммита — `[skip render]` в сообщении коммита.

Особенности бесплатного тарифа ([render.com/docs/free](https://render.com/docs/free)):

- **Холодный старт.** Сервис засыпает после 15 минут без входящих запросов; первый запрос после сна будит его — около минуты ожидания.
- 750 бесплатных часов в месяц на workspace — одному сервису хватает.
- Один экземпляр, без постоянных дисков и SSH; диагностика — логи в Dashboard или через Render MCP.

### Render MCP

Для работы с сервисом из Claude Code подключается официальный плагин Render со входом через OAuth — API-ключи и токены не нужны и в репозиторий не попадают (`.mcp.json` в проекте нет):

```text
/plugin install render@claude-plugins-official
/reload-plugins
```

При первом обращении к Render MCP откроется авторизация в браузере. Затем выберите workspace, например: `Set my Render workspace to <имя workspace>`. Через MCP удобно смотреть сервис, деплои, логи и метрики. Операции, меняющие сервис (запуск деплоя, изменение переменных окружения), согласуются с владельцем. Сам сервис создаётся в Dashboard по Blueprint, не через MCP. Документация: [render.com/docs/mcp-server](https://render.com/docs/mcp-server).

### Railway — запасной вариант

Если Render недоступен, тот же образ разворачивается на [Railway](https://railway.com/): новый сервис из GitHub-репозитория собирается по `Dockerfile` в корне, Railway сам передаёт `PORT`, health check — `/api/health`. Ограничения хранения данных те же.

## Ограничения

- **Данные хранятся только в памяти процесса** (решение D-06, [ADR-0003](docs/adr/0003-booking-atomicity-sync-check-and-insert.md)). Типы встреч и бронирования **не сохраняются**: они пропадают при каждом деплое, перезапуске и засыпании сервиса. Render может перезапустить бесплатный сервис в любой момент, поэтому опубликованное приложение — демонстрация, а не место для настоящих записей.
- Во время деплоя ненадолго работают старый и новый экземпляры, данные между ними не переносятся.
- Раздел `/admin` не защищён авторизацией — его может открыть любой, кто знает адрес.
- Работает один экземпляр сервиса: на этом держится атомарность бронирования. Постоянное хранилище и масштабирование — отдельный этап с пересмотром ADR-0003.

<!-- Добавьте запись asciinema — именно это смотрит работодатель -->

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
