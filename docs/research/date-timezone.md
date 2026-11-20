# Даты и часовой пояс `Europe/Warsaw`: библиотека для Node 24 и браузера

Исследование к issue #4 (вопрос T-05 из `docs/stack-research.md`). Дата исследования: 2026-11-20.

## Вопрос

Как работать с датами и поясом `Europe/Warsaw` (включая переходы DST) одинаково в backend (Node.js 24.22.x через mise, Fastify) и во frontend (React 19 + Vite 8)? Нужно:

- определять «сегодня» и «завтра» в `Europe/Warsaw` (BR-01…BR-03, AC-07);
- строить сетку стартов через 30 минут с 09:00 до 18:00 на локальную дату (BR-05, BR-09…BR-11, AC-11), в том числе в дни перехода (2026-03-29, 2026-10-25);
- форматировать и разбирать ISO 8601 со смещением `2026-11-21T10:00:00+01:00`, а день передавать как `YYYY-MM-DD` (решение в issue #2, п. 4);
- сравнивать интервалы, чтобы проверять пересечения бронирований (BR-12, BR-14…BR-17).

Кандидаты: `Temporal` (нативный или через полифил), date-fns v4 + `@date-fns/tz`, Luxon, только `Intl`/`Date`.

## Кратко (рекомендация)

**Рекомендую `Temporal` через пакет `temporal-polyfill` в режиме ponyfill (`import { Temporal } from 'temporal-polyfill'`) — один и тот же код в backend и frontend.**

- В Node.js 24 `Temporal` есть только за экспериментальным флагом `--harmony-temporal`. По умолчанию он включён начиная с Node.js 26. В браузерах: Chrome и Edge 144+, Firefox 139+. Safari добавляет его в 27.3, а эта версия пока в бете. Поэтому полифил нужен, но ponyfill сам переключается на нативную реализацию, если она есть ([README](https://github.com/fullcalendar/temporal-polyfill)).
- В модели `Temporal` есть все нужные понятия: `PlainDate` — это `YYYY-MM-DD`, `ZonedDateTime` — момент в Варшаве, `Instant` — точка для сравнения. Для DST-переходов есть явные правила (`disambiguation`). Разбор строки без смещения бросает ошибку, а не подставляет пояс сервера.
- Цена — около 19 КБ gzip во frontend. Это примерно вдвое больше, чем date-fns + `@date-fns/tz` (около 8,6 КБ). Когда проект перейдёт на Node 26 и Safari 27.3 станет стабильным, полифил можно убрать: API тот же, меняется только импорт.
- **Запасной вариант** — date-fns v4 + `@date-fns/tz` (`TZDate`): он меньше, работает на привычном `Date`, а сетка и ISO в тестах совпали с `Temporal`. Минусы: нет явного выбора поведения в неоднозначные часы, а `parseISO` молча принимает строки без смещения.
- Luxon и «только `Intl`» не рекомендую (обоснование ниже).

Решение остаётся за владельцем проекта. Отдельный вопрос, который снимает потребность в полифиле на backend: переход на Node 26. Это тема T-07, и в этом исследовании она не решается.

## Варианты

| Критерий                                       | `Temporal` + `temporal-polyfill`                                                           | date-fns 4 + `@date-fns/tz`                                    | Luxon 3                                 | Только `Intl` + `Date`   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------- | ------------------------ |
| Последняя версия (npm)                         | 1.0.8 — 2026-11-04                                                                         | date-fns 4.4.0 — 2026-05-29; `@date-fns/tz` 1.5.0 — 2026-05-21 | 3.7.2 — 2025-09-05                      | встроено                 |
| Node 24.22                                     | полифил (нативный — только с флагом)                                                       | да                                                             | да                                      | да                       |
| Браузеры                                       | нативно Chrome/Edge 144+, Firefox 139+; иначе полифил                                      | да                                                             | да                                      | да                       |
| Типы TypeScript                                | свои `.d.ts` в пакете; глобальные типы есть в TS 6/7 (`lib: esnext` или `esnext.temporal`) | свои `.d.ts` в пакете                                          | отдельно `@types/luxon` 3.7.6           | `lib` TypeScript         |
| Размер во frontend (min / gzip, замер esbuild) | 56,2 / 19,4 КБ                                                                             | 28,2 / 8,6 КБ (вместе с `format` и en-US)                      | 70,9 / 21,9 КБ                          | 0                        |
| Зоны IANA                                      | все (данные из `Intl` среды)                                                               | IANA и смещения (через `Intl`)                                 | через `Intl`                            | `Intl.DateTimeFormat`    |
| Неоднозначное время (fall back)                | явная опция `disambiguation`                                                               | всегда раннее смещение (по замеру), опции нет                  | выбор не гарантирован (по документации) | вручную                  |
| Разбор строки без смещения                     | ошибка (`RangeError`)                                                                      | молча берёт пояс процесса                                      | молча берёт пояс процесса               | `Date` — пояс процесса   |
| Одна модель на front и back                    | да                                                                                         | да                                                             | да                                      | да, но много своего кода |

Размеры сняты на минимальном входе: `esbuild --bundle --minify`, затем `gzip -9`.

## Детали по каждому варианту

### 1. `Temporal` (нативный / `temporal-polyfill`)

- **Статус стандарта.** Предложение TC39 находится на Stage 4 ([tc39/proposal-temporal](https://github.com/tc39/proposal-temporal)). Полифил из самого репозитория предложения в продакшене использовать нельзя: «DO NOT use this polyfill in your own projects!». Там же `temporal-polyfill` назван stable, а `@js-temporal/polyfill` — alpha.
- **Node.js 24.** В Node v24.22.3 (V8 13.6, ICU 78.3, tzdata 2026e) `typeof Temporal === 'undefined'`. Флаг V8 `--harmony-temporal` описан как «in progress / experimental» (проверено через `node --v8-options`). С флагом все сценарии ниже проходят, но экспериментальный флаг для продакшена не годится.
- **Node.js 26.** В заметках к релизу: «The Temporal API is now enabled by default in Node.js 26» ([v26.0.0](https://nodejs.org/en/blog/release/v26.0.0)). По [расписанию релизов](https://github.com/nodejs/Release): 26.x — Active LTS с 2026-10-28, а 24.x — Maintenance LTS с 2026-10-20 до EOL 2028-04-30.
- **Браузеры** (данные [`@mdn/browser-compat-data`](https://github.com/mdn/browser-compat-data) 8.1.10 от 2026-11-19, `javascript.builtins.Temporal`): Chrome и Edge 144, Firefox 139, Opera 128, Safari и Safari iOS 27.3. Версия 27.3 имеет статус `beta`, текущая стабильная — 27.2 от 2026-10-26. Текущие стабильные версии других браузеров: Chrome 158, Edge 157, Firefox 160. Получается, что без полифила `Temporal` сейчас не работает в стабильном Safari.
- **Пакет `temporal-polyfill`** (FullCalendar): версия 1.0.8, MIT, только ESM. Точка `temporal-polyfill` — это ponyfill без побочных эффектов, который «Uses native if available». Точка `temporal-polyfill/global` подменяет глобальный объект. Соответствие спецификации описано так: «near-perfect with just 2 intentional deviations». «All time zones are supported». CI проверяет Node 16…26. Vitest с пулом `forks` по умолчанию работает ([README](https://github.com/fullcalendar/temporal-polyfill)).
- **`@js-temporal/polyfill`** — 0.5.1 от 2025-03-31, почти 3 МБ в распакованном виде. Не рекомендую: давно не обновлялся, и сам TC39 называет его alpha.
- **TypeScript.** Проверено локально: и TS 7.0.2 (`tsc` в `apps/*`), и TS 6.0.2 (алиас для ESLint) знают глобальный `Temporal` при `lib: ["esnext"]` или `lib: ["ES2024", "esnext.temporal"]`. Сейчас в `apps/*` стоит `lib` ES2023/ES2024, поэтому глобального типа там нет. При импорте из ponyfill типы берутся из `.d.ts` пакета, и менять `lib` не нужно.
- **Как это выглядит в коде:**
  - «сегодня»: `Temporal.Now.plainDateISO('Europe/Warsaw')`, «завтра»: `.add({ days: 1 })`;
  - сетка: `date.toZonedDateTime({ timeZone, plainTime: '09:00' })`, затем `.add({ minutes: 30 })`, пока `< 18:00`;
  - формат API: `zdt.toString({ timeZoneName: 'never' })` → `2026-11-21T10:00:00+01:00`;
  - разбор: `Temporal.Instant.from(s).toZonedDateTimeISO('Europe/Warsaw')`;
  - сравнение: `Temporal.Instant.compare` (интервалы `[a0,a1)` и `[b0,b1)` пересекаются, если `a0 < b1 && b0 < a1`).
- **Минусы:** около 19 КБ gzip во frontend, новый для команды API, многословнее date-fns. Объекты `Temporal` нельзя передавать прямо в `JSON.stringify` или SDK: сначала нужен `toString()`.

### 2. date-fns v4 + `@date-fns/tz`

- **Версии и активность:** date-fns 4.4.0 (2026-05-29) и `@date-fns/tz` 1.5.0 (2026-05-21), обе под MIT. Типы лежат в пакетах (`exports` → `types`).
- **Устройство.** `TZDate` — это расширение `Date`, которое «perform[s] calculations in a specified time zone». Начиная с v4 функции принимают контекст `{ in: tz('Europe/Warsaw') }`. Для «сейчас» нужен `TZDate.tz(zone)`, потому что `new TZDate(zone)` даёт Invalid Date ([date-fns/tz](https://github.com/date-fns/tz)).
- **Замер:** «сегодня/завтра», сетка из 18 стартов в обычный день и в оба дня перехода, `formatISO` → `2026-11-21T10:00:00+01:00`, `parseISO(s, { in: tz(Z) })` → `TZDate` и `areIntervalsOverlapping` дали такие же результаты, как `Temporal`. При этом `TZDate#toISOString()` выводит строку со смещением зоны, а не `Z`.
- **Минусы.** Для неоднозначных 02:30 25 октября `new TZDate(...)` всегда выбрал `+02:00`, и выбрать другое поведение нельзя. `parseISO` без смещения молча использует пояс процесса, поэтому API придётся валидировать отдельно. Модель «дата без времени» (`YYYY-MM-DD`) приходится представлять строкой или `Date` в полночь. Пакет `date-fns-tz` (3.2.0, 2024-09-30) — старая отдельная библиотека, для v4 её заменяет `@date-fns/tz`.

### 3. Luxon

- **Версии:** 3.7.2 вышла 2025-09-05 — больше года без релизов. Типы ставятся отдельно: `@types/luxon` 3.7.6 из DefinitelyTyped.
- **Устройство.** Зоны работают через `Intl`: «Luxon gains direct support for them by abusing built-in Intl APIs». Несуществующее время «will be advanced by an hour». Для неоднозначного документация говорит: «It makes no promises about which of the two possible timestamps the instance will represent» ([zones.md](https://github.com/moment/luxon/blob/master/docs/zones.md)). В замере 02:30 25 октября дало `+01:00`, то есть поведение обратное date-fns.
- **Минусы:** самый большой бандл (около 21,9 КБ gzip), ниже активность, неоднозначное время не определено документацией. По функциональности Luxon близок к `Temporal`, но это не стандарт.

### 4. Только `Intl` + `Date`

- `Intl.DateTimeFormat` с `timeZone: 'Europe/Warsaw'` и `timeZoneName: 'longOffset'` даёт локальные дату, время и смещение (`GMT+01:00`) для заданного момента. `Intl.supportedValuesOf('timeZone')` в Node 24 содержит `Europe/Warsaw`.
- Обратной операции «локальное 09:00 в Варшаве → момент» в `Intl` нет. Её пришлось бы писать самим: подбирать смещение, обрабатывать разрыв и наложение. Именно это уже делают все библиотеки выше. Риск ошибок в DST высокий, тестов придётся писать много. Не рекомендую.

## Поведение в DST

Переходы в `Europe/Warsaw` в 2026 году: **29 марта** в 02:00 часы переводят на 03:00 (+01:00 → +02:00), длина дня 23 ч; **25 октября** в 03:00 — обратно на 02:00 (+02:00 → +01:00), длина дня 25 ч. Замер `Temporal` `hoursInDay`: 23, 25 и 24 для 2026-11-21. Luxon дал те же значения.

Сетка 09:00–18:00 с шагом 30 минут (старты строго до 18:00; длительность типа ограничивает их дополнительно, см. BR-05):

| День       | Стартов | Первый                      | Последний                   |
| ---------- | ------- | --------------------------- | --------------------------- |
| 2026-03-29 | 18      | `2026-03-29T09:00:00+02:00` | `2026-03-29T17:30:00+02:00` |
| 2026-10-25 | 18      | `2026-10-25T09:00:00+01:00` | `2026-10-25T17:30:00+01:00` |
| 2026-11-21 | 18      | `2026-11-21T09:00:00+01:00` | `2026-11-21T17:30:00+01:00` |

Результаты одинаковы у `Temporal` (полифил и нативный с флагом), date-fns + `@date-fns/tz` и Luxon. Рабочие часы не задевают переход (02:00–03:00), поэтому сетка в эти дни просто сдвигается по смещению.

Где нужна осторожность:

- **Шаг сетки задаётся в локальном времени зоны**, а не прибавлением `24 * 3600 * 1000` мс к `Date`. «Завтра» нужно считать как `+1 day` в зоне: в дни перехода +24 часа дают другое локальное время. Luxon это тоже документирует.
- **Окно 14 дней** (BR-01, AC-07) нужно строить как последовательность `PlainDate` (`YYYY-MM-DD`) от «завтра в Варшаве», а не как интервал в миллисекундах.
- **Несуществующее 02:30 (29.03)**: все три библиотеки дают `03:30+02:00`. **Неоднозначное 02:30 (25.10)**: `Temporal` позволяет выбрать явно (`earlier` → `+02:00`, `later` → `+01:00`), date-fns дал `+02:00`, Luxon — `+01:00`. Рабочие часы этих моментов не касаются, но различие стоит помнить.
- **Разбор входа API.** Если клиент пришлёт смещение, не совпадающее с Варшавой (например, `10:00+02:00` в ноябре), то это тот же момент `09:00+01:00`. Сервер должен сравнивать по моменту (`Instant`) с допустимыми стартами, а не по строке.
- **Свежесть tzdata.** Правила зон берутся из ICU среды: в Node 24.22.3 это tzdata 2026e, в браузере — данные самого браузера. Для Варшавы правила стабильны, но тесты стоит строить на фиксированных датах 2026-03-29 и 2026-10-25 и подменять «сейчас» (inject clock), а не полагаться на `TZ` процесса.

## Источники

- Issue #4 (вопрос), issue #2 (решение о формате времени в API), `docs/requirements.md` (BR-01…BR-05, BR-09…BR-17, AC-07, AC-11), `docs/stack-research.md` (T-05).
- TC39 Temporal, статус Stage 4 и список полифилов: https://github.com/tc39/proposal-temporal
- Node.js 26.0.0 — Temporal включён по умолчанию: https://nodejs.org/en/blog/release/v26.0.0
- Расписание релизов Node.js: https://github.com/nodejs/Release
- Node.js 24.22.3 локально: `process.versions` (V8 13.6.233.17, ICU 78.3, tz 2026e), `node --v8-options` (`--harmony-temporal`).
- Поддержка браузерами — `@mdn/browser-compat-data` 8.1.10 (`javascript.builtins.Temporal`, `browsers.*.releases`): https://github.com/mdn/browser-compat-data ; страница MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal ; заметки к Safari 27.3 (beta): https://developer.apple.com/documentation/safari-release-notes/safari-27_3-release-notes
- `temporal-polyfill` (README в пакете 1.0.8): https://github.com/fullcalendar/temporal-polyfill , https://www.npmjs.com/package/temporal-polyfill
- `@js-temporal/polyfill`: https://www.npmjs.com/package/@js-temporal/polyfill
- `@date-fns/tz`: https://github.com/date-fns/tz , https://www.npmjs.com/package/@date-fns/tz ; date-fns: https://www.npmjs.com/package/date-fns ; date-fns-tz: https://www.npmjs.com/package/date-fns-tz
- Luxon, зоны и DST: https://github.com/moment/luxon/blob/master/docs/zones.md ; https://www.npmjs.com/package/luxon ; https://www.npmjs.com/package/@types/luxon
- Версии и даты релизов — `npm view <pkg> version time` (2026-11-20).
- Поведение и размеры — локальные замеры автора исследования: Node 24.22.3, esbuild (`--bundle --minify`, gzip -9). Глобальные типы `Temporal` проверены через `tsc` 7.0.2 и `@typescript/typescript6` 6.0.2.
