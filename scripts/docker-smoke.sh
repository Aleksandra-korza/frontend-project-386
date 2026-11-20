#!/usr/bin/env bash
# Smoke-проверка Docker-образа (docs/specs/deploy.md §3): сборка, два контейнера
# (PORT по умолчанию и PORT=10000), ответы /api/health (JSON), / и /book (HTML),
# содержимое образа (USER node; нет .git, .env*, .claude, dev-зависимостей, тестов).
# Останавливает только свои контейнеры. Запуск: mise run docker-smoke (локально и в CI).
#
# Переменные окружения:
#   IMAGE              имя образа (по умолчанию calendar-calls)
#   SKIP_BUILD=1       не собирать образ, проверить уже собранный
#   HOST_PORT_DEFAULT  хост-порт контейнера с PORT по умолчанию (14000)
#   HOST_PORT_CUSTOM   хост-порт контейнера с PORT=10000 (15000)
set -euo pipefail

IMAGE="${IMAGE:-calendar-calls}"
HOST_PORT_DEFAULT="${HOST_PORT_DEFAULT:-14000}"
HOST_PORT_CUSTOM="${HOST_PORT_CUSTOM:-15000}"
PREFIX="$(printf '%s' "$IMAGE" | tr -c 'a-zA-Z0-9_.-' '-')-smoke-$$"
CONTAINERS=()

# ${arr[@]+...}: пустой массив под set -u в bash 3.2 (macOS) — ошибка.
cleanup() {
  for c in ${CONTAINERS[@]+"${CONTAINERS[@]}"}; do
    docker rm -f "$c" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  for c in ${CONTAINERS[@]+"${CONTAINERS[@]}"}; do
    echo "--- docker logs $c ---" >&2
    docker logs "$c" >&2 || true
  done
  exit 1
}

cd "$(dirname "$0")/.."

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  docker build -t "$IMAGE" .
fi

# Готовность: /api/health отвечает 200 (до 30 секунд).
wait_ready() {
  local base="$1"
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "$base/api/health" 2>/dev/null; then
      return 0
    fi
    sleep 0.5
  done
  fail "$base/api/health не ответил за 30 с"
}

# check <URL> <ожидаемый Content-Type> <подстрока тела>
check() {
  local url="$1" type="$2" body_part="$3" tmp status ctype body
  tmp="$(mktemp -d)"
  status="$(curl -sS -D "$tmp/h" -o "$tmp/b" -w '%{http_code}' \
    -H 'Accept: text/html,application/json' "$url")" || fail "$url: запрос не выполнен"
  ctype="$(grep -i '^content-type:' "$tmp/h" | tr -d '\r' | cut -d' ' -f2-)"
  body="$(cat "$tmp/b")"
  rm -rf "$tmp"
  [ "$status" = "200" ] || fail "$url: статус $status, ожидался 200"
  case "$ctype" in
    "$type"*) ;;
    *) fail "$url: Content-Type '$ctype', ожидался $type" ;;
  esac
  [[ "$body" == *"$body_part"* ]] || fail "$url: в теле нет '$body_part'"
  echo "ok  $url -> $status $ctype"
}

check_app() {
  local base="$1"
  wait_ready "$base"
  check "$base/api/health" application/json '"status":"ok"'
  check "$base/" text/html '<div id="root">'
  check "$base/book" text/html '<div id="root">'
}

# 1. PORT по умолчанию (4000).
CONTAINERS+=("$PREFIX-default")
docker run -d --rm --name "$PREFIX-default" -p "$HOST_PORT_DEFAULT:4000" "$IMAGE" >/dev/null
check_app "http://127.0.0.1:$HOST_PORT_DEFAULT"

# 2. PORT=10000 (так его задаёт Render).
CONTAINERS+=("$PREFIX-port10000")
docker run -d --rm --name "$PREFIX-port10000" -e PORT=10000 \
  -p "$HOST_PORT_CUSTOM:10000" "$IMAGE" >/dev/null
check_app "http://127.0.0.1:$HOST_PORT_CUSTOM"

# 3. Содержимое образа (каталог приложения /app; npm и corepack базового образа
# в /usr/local не проверяются). Файлы проекта — без node_modules: исходники (*.ts),
# тесты, .git, .env*, .claude. В node_modules — нет dev-зависимостей.
docker run --rm --entrypoint sh "$IMAGE" -c '
  [ "$(id -un)" = node ] || { echo "пользователь $(id -un), ожидался node"; exit 1; }
  own="$(find /app -name node_modules -prune -o \( -name .git -o -name ".env*" \
    -o -name .claude -o -name "*.ts" -o -name "*.tsx" -o -name "*.test.*" \
    -o -name testing \) -print)"
  dev="$(find /app -path "*/node_modules/*" \( -name vite -o -name typescript \
    -o -name vitest -o -name tsx -o -name @playwright -o -name "playwright*" \
    -o -name @typespec -o -name pnpm \) -prune -print)"
  found="$own$dev"
  if command -v pnpm >/dev/null; then found="$found pnpm: $(command -v pnpm)"; fi
  if [ -n "$found" ]; then echo "в образе лишнее:"; echo "$found"; exit 1; fi
' || fail "содержимое образа"
echo "ok  содержимое образа: USER node; нет .git, .env*, .claude, dev-зависимостей, тестов"

echo "docker smoke: OK"
