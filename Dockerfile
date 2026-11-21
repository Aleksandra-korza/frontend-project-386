# Один образ: Fastify раздаёт API (/api/*) и собранный frontend (ADR-0006).
# Спецификация: docs/specs/deploy.md §3. Проверка: mise run docker-smoke.

# --- deps: зависимости для сборки (вместе с dev) строго по pnpm-lock.yaml ---
FROM node:24-slim AS deps
WORKDIR /app
# pnpm — версия из packageManager (package.json) через corepack, без вопроса о загрузке.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY e2e/package.json e2e/
# Пакет e2e (Playwright) для сборки не нужен — его зависимости не ставятся.
RUN pnpm install --frozen-lockfile --filter '!@calendar/e2e'

# --- build: backend (tsc) и frontend (vite); codegen не нужен — сгенерированное в Git ---
FROM deps AS build
COPY api/generated api/generated
COPY apps apps
RUN pnpm build
# Только prod-зависимости backend, без ссылок на workspace.
RUN pnpm --filter @calendar/backend deploy --prod --legacy /prod/backend

# --- runtime: Node.js, prod-зависимости backend и собранные файлы ---
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000
# Раскладка как в репозитории: backend читает ../../../api/generated/openapi.json
# и раздаёт ../../frontend/dist относительно apps/backend/dist.
COPY --from=build /prod/backend/package.json apps/backend/package.json
COPY --from=build /prod/backend/node_modules apps/backend/node_modules
COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY --from=build /app/api/generated/openapi.json api/generated/openapi.json
COPY --from=build /app/apps/frontend/dist apps/frontend/dist
USER node
EXPOSE 4000
CMD ["node", "apps/backend/dist/server.js"]
