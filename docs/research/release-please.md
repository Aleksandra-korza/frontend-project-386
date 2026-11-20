# Исследование: release-please для pnpm-монорепозитория

> Статус: исследование и предложение. Файлы конфигурации и workflow **не созданы**, решение принимает человек.
> Тикет: [#12](https://github.com/Aleksandra-korza/frontend-project-386/issues/12). Дата: 2026-11-20.
> Источники — только первичные: репозитории `googleapis/release-please`, `googleapis/release-please-action`, GitHub Docs, GitHub API. Ссылки указаны у каждого утверждения и собраны в разделе «Источники».

## Вопрос

Как по актуальной официальной документации настроить release-please для этого репозитория (pnpm workspace: корневой `package.json` `calendar-calls` с `private: true` без `version`; пакеты `apps/backend` и `apps/frontend` с `private: true`, `version: 0.0.0`)? Какой action и SHA, какой режим (простой или манифест), какой `release-type`, какие права токена, как это сочетается с Conventional Commits (commitlint `config-conventional`) и существующими workflow `check.yml` и `hexlet-check.yml` (последний изменять нельзя)?

## Кратко (рекомендация)

1. **Один релиз на весь репозиторий**: манифест-режим с единственным пакетом `"."`, `release-type: node`, `include-component-in-tag: false` (теги `v0.1.0`), `initial-version: 0.1.0`. Корневой `CHANGELOG.md` уже исключён из Prettier правилом `/*.md` в `.prettierignore`.
2. **Action**: `googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0`, отдельный workflow `.github/workflows/release-please.yml` на `push` в `main`.
3. **Права**: `contents: write`, `pull-requests: write`, `issues: write` на уровне job. В настройках репозитория нужно включить «Allow GitHub Actions to create and approve pull requests» (сейчас выключено).
4. **Токен**: стандартный `GITHUB_TOKEN`. Недостаток: release PR и тег не запустят `check.yml` и `hexlet-check.yml`. Проверки пройдут после merge release PR в `main`, потому что этот push делает человек. PAT стоит заводить только тогда, когда CI нужен на самом release PR.
5. **Ограничение**: release-please работает только после того, как `setup/agent-environment` попадёт в `main`. Сейчас в `main` лежат только `README.md` и `hexlet-check.yml`.

Почему не по пакетам: коммиты `feat(api):` меняют `api/` в корне, а не `apps/*`, и в per-package режиме они не попали бы ни в один пакет. Пакеты `private` и ничего не публикуют, между собой не зависят, так что `node-workspace` ничего не даёт.

## Версия action и SHA

| Что                                 | Значение                                                                                             | Источник                                                                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Последний релиз action              | `v5.0.0` (Latest, 2026-04-22)                                                                        | [releases/tag/v5.0.0](https://github.com/googleapis/release-please-action/releases/tag/v5.0.0)                                                                                          |
| SHA коммита тега `v5.0.0`           | `45996ed1f6d02564a971a2fa1b5860e934307cf7` (lightweight-тег, `object.type: commit`)                  | `gh api repos/googleapis/release-please-action/git/ref/tags/v5.0.0`                                                                                                                     |
| Тег `v5`                            | annotated-тег `0dfd8538845b8e92600d271a895a5372865d4062`, указывает на тот же коммит `45996ed1…`     | `gh api …/git/ref/tags/v5`, `gh api …/git/tags/0dfd8538…`                                                                                                                               |
| Breaking change в v5                | «upgrade to node24»: `runs.using: node24`. Входы те же, что в v4                                     | [release notes v5.0.0](https://github.com/googleapis/release-please-action/releases/tag/v5.0.0), [action.yml](https://github.com/googleapis/release-please-action/blob/main/action.yml) |
| Версия release-please внутри action | 17.6.0 (bump в v5.0.0). Последний релиз библиотеки — `v17.11.2` (2026-08-24), action от него отстаёт | [release notes v5.0.0](https://github.com/googleapis/release-please-action/releases/tag/v5.0.0), [releases release-please](https://github.com/googleapis/release-please/releases)       |
| Предыдущая линия                    | `v4.4.1` (2026-04-13)                                                                                | [releases](https://github.com/googleapis/release-please-action/releases)                                                                                                                |

README action всё ещё показывает `@v4` в примерах. Актуальная линия по релизам — v5.

Закрепление по SHA. GitHub рекомендует указывать полный SHA коммита, потому что тег можно передвинуть или удалить ([Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)). В репозитории `sha_pinning_required: false` (`gh api repos/…/actions/permissions`), но `check.yml` уже закрепляет actions по SHA с комментарием-версией. Предлагается тот же стиль.

## Режимы и конфигурация

### Входы action (`action.yml`, README)

| Вход            | Значение по умолчанию                       | Комментарий                                                                                                  |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `token`         | `${{ github.token }}`                       | Без PAT созданные ресурсы не запускают другие workflow (см. ниже)                                            |
| `release-type`  | пусто                                       | Если задан, используется «простой» режим, который README описывает как «allows for no further customization» |
| `config-file`   | `release-please-config.json`                | Манифест-режим                                                                                               |
| `manifest-file` | `.release-please-manifest.json`             | Манифест-режим                                                                                               |
| `target-branch` | определяется автоматически (default branch) | Здесь default branch — `main`                                                                                |

Источник: [action.yml](https://github.com/googleapis/release-please-action/blob/main/action.yml), [README → Action Inputs](https://github.com/googleapis/release-please-action#action-inputs).

### Простой режим и манифест

- **Простой режим** (`release-type: node` прямо в workflow): минимум файлов, но нельзя задать `initial-version`, `changelog-sections`, `bootstrap-sha` и другие опции ([README → Basic Configuration](https://github.com/googleapis/release-please-action#basic-configuration)).
- **Манифест-режим** (`release-please-config.json` + `.release-please-manifest.json`): все опции из [JSON-схемы](https://github.com/googleapis/release-please/blob/main/schemas/config.json). Манифест должен существовать на вершине target-ветки, допустим пустой `{}` ([manifest-releaser.md → Manifest](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#manifest)). Если `release-type` в конфиге не указан, используется `node` ([manifest-releaser.md → Configfile](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#configfile)).

### `node` или `simple` для корня без `version`

Факты из исходников `src/strategies/node.ts`, `src/updaters/node/package-json.ts` и `src/strategies/base.ts` ([node.ts](https://github.com/googleapis/release-please/blob/main/src/strategies/node.ts), [package-json.ts](https://github.com/googleapis/release-please/blob/main/src/updaters/node/package-json.ts), [base.ts](https://github.com/googleapis/release-please/blob/main/src/strategies/base.ts)):

- `node` берёт из `package.json` только `name` (имя компонента). Если `package.json` нет, выдаёт `MissingRequiredFileError`. Текущая версия берётся из манифеста или последнего релиза, а не из поля `version`.
- Updater `PackageJson` выполняет `parsed.version = this.version`. Если поля нет, оно будет **добавлено** в release PR. Отсутствие `version` в корне ошибкой не считается.
- `private: true` на release-please не влияет: публикации в npm у него нет, она описывается отдельными шагами ([README → Automating publication to npm](https://github.com/googleapis/release-please-action#automating-publication-to-npm)).
- `node` обновляет только `package-lock.json` и `npm-shrinkwrap.json`. **`pnpm-lock.yaml` он не трогает.** Для workspace-пакетов без взаимных зависимостей смена `version` lock-файл не меняет, поэтому `pnpm install --frozen-lockfile` в CI не сломается. Это вывод, его стоит проверить на первом release PR.
- Если в манифесте нет версии и нет прошлого релиза, первая версия равна `initialReleaseVersion()`: `initial-version` из конфига, иначе **`1.0.0`**. В `manifest-releaser.md` написано «0.1.0 for node», но в коде `node.ts` этот метод не переопределяется, так что документация здесь устарела.
- `simple` обновляет `version.txt` с `createIfMissing: false` ([simple.ts](https://github.com/googleapis/release-please/blob/main/src/strategies/simple.ts)): файл придётся создать вручную. При этом версия в `package.json` не появится. Для Node-репозитория `node` подходит лучше.

### Один релиз на репозиторий или по пакетам

| Вариант                                   | Плюсы                                                                                                                                                     | Минусы                                                                                                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Один пакет `"."` (рекомендуется)**   | Один `CHANGELOG.md` в корне (Prettier его игнорирует), один тег, учитываются коммиты в `api/`, `mise.toml` и т. д.                                        | Версии `apps/*` остаются `0.0.0`. Синхронизировать их можно через `extra-files` или `linked-versions`, но это лишняя сложность                                                                          |
| B. Пакеты `apps/backend`, `apps/frontend` | Отдельные версии и CHANGELOG для каждого приложения                                                                                                       | Коммиты в `api/` и корне не попадают ни в один пакет. Новые `apps/*/CHANGELOG.md` проверяет Prettier, а формат release-please (`*`-списки) не пройдёт `format:check` без исключения в `.prettierignore` |
| B + `node-workspace`                      | Автоматический bump зависимых пакетов ([node-workspace](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#node-workspace)) | Взаимных зависимостей между `apps/*` нет, так что плагин ничего не даёт                                                                                                                                 |
| B + `separate-pull-requests: true`        | Отдельный release PR на каждый пакет ([схема](https://github.com/googleapis/release-please/blob/main/schemas/config.json))                                | Больше PR и тегов при двух приватных приложениях                                                                                                                                                        |

В варианте B компонент — это имя пакета без scope: `normalizeComponent` превращает `@calendar/backend` в `backend` ([node.ts](https://github.com/googleapis/release-please/blob/main/src/strategies/node.ts)). Теги в этом случае `backend-v…`, потому что в манифест-режиме `include-component-in-tag` по умолчанию `true` ([схема](https://github.com/googleapis/release-please/blob/main/schemas/config.json)).

### Начальная версия и `bootstrap-sha`

- `initial-version` задаёт первую версию ([схема](https://github.com/googleapis/release-please/blob/main/schemas/config.json)). Другой путь — вручную внести версию в манифест, например `{ ".": "0.0.0" }`. Тогда release-please считает её последней выпущенной и поднимает по коммитам ([manifest-releaser.md → Initial Version](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#initial-version)).
- `bootstrap-sha` (полный SHA, только на верхнем уровне) ограничивает, с какого коммита собирать историю для первого CHANGELOG. После первого merge release PR опция игнорируется ([manifest-releaser.md → Starting commit](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#starting-commit)). Ранние коммиты `main` («Add README.md») не соответствуют Conventional Commits, release-please их и так пропускает (`commit could not be parsed`, [commit.ts](https://github.com/googleapis/release-please/blob/main/src/commit.ts)). Поэтому `bootstrap-sha` нужен, только если первый CHANGELOG должен начинаться позже. Пример: `5d07c9bf52efe8b4d4ff2dfaaa3bb0b2e2b0fd61` (текущая вершина `origin/main`).
- Если бы версия была `< 1.0.0`, `bump-minor-pre-major: true` превращал бы `feat!` в minor, а не в major ([manifest-releaser.md → Configfile](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#configfile)).

### Пример минимальной конфигурации (вариант A)

> **Предложение. Эти файлы не созданы.**

`release-please-config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "include-component-in-tag": false,
  "bump-minor-pre-major": true,
  "packages": {
    ".": {
      "initial-version": "0.1.0"
    }
  }
}
```

`.release-please-manifest.json`:

```json
{}
```

`.github/workflows/release-please.yml`:

```yaml
name: release-please

on:
  push:
    branches: [main]

permissions: {}

jobs:
  release-please:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0
        with:
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

`target-branch` указывать не нужно: default branch — `main` (`gh repo view --json defaultBranchRef`). `token` тоже можно не указывать, по умолчанию берётся `GITHUB_TOKEN`.

## Права и настройки репозитория

- README action требует `contents: write`, `issues: write`, `pull-requests: write` ([README → Workflow Permissions](https://github.com/googleapis/release-please-action#workflow-permissions)). `issues: write` нужен для меток release PR, например `autorelease: pending` ([README release-please → Step 2](https://github.com/googleapis/release-please#step-2-ensure-no-autorelease-pending-or-autorelease-triggered-label-in-an-old-pr)): метки в GitHub API относятся к Issues API. Если выставить `skip-labeling: true`, этот scope, по всей видимости, не понадобится, но тогда release-please хуже находит свои PR. Оставляем scope, как в README.
- README: «You may also need to set "Allow GitHub Actions to create and approve pull requests" under repository Settings > Actions > General» ([README](https://github.com/googleapis/release-please-action#workflow-permissions)). В личных репозиториях workflow по умолчанию не могут создавать PR ([GitHub Docs → Managing GitHub Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)).
- Текущее состояние: `default_workflow_permissions: read`, `can_approve_pull_request_reviews: false` (`gh api repos/Aleksandra-korza/frontend-project-386/actions/permissions/workflow`). Флажок нужно включить. Default-права можно оставить `read`, потому что `permissions` задаются в самом job.

## Conventional Commits и CHANGELOG

- Bump: `fix:` даёт patch, `feat:` даёт minor, `!` или `BREAKING CHANGE` дают major ([README release-please](https://github.com/googleapis/release-please#how-should-i-write-my-commits)).
- Release PR открывается только при наличии «releasable units»: коммитов `feat`, `fix`, `deps`. «A "chore" or "build" commit is not a releasable unit» ([README → Release Please bot does not create a release PR](https://github.com/googleapis/release-please#release-please-bot-does-not-create-a-release-pr-why)). Если после фильтрации секций CHANGELOG пуст, PR не создаётся (`No user facing commits found`, [base.ts](https://github.com/googleapis/release-please/blob/main/src/strategies/base.ts)).
- Секции по умолчанию ([filter-commits.ts](https://github.com/googleapis/release-please/blob/main/src/util/filter-commits.ts)): видимые — `feat` (Features), `fix` (Bug Fixes), `perf` (Performance Improvements), `revert` (Reverts). Скрытые — `chore`, `docs`, `style`, `refactor`, `test`, `build`, `ci`. Скрытый коммит попадает в CHANGELOG только с `BREAKING CHANGE`. Поэтому `docs:` и `chore:` в changelog не видны. Если нужно, `changelog-sections` переопределяет это ([схема](https://github.com/googleapis/release-please/blob/main/schemas/config.json)).
- Scope: CHANGELOG строится пресетом `conventional-changelog-conventionalcommits` ([default.ts](https://github.com/googleapis/release-please/blob/main/src/changelog-notes/default.ts)), он выводит scope жирным префиксом (`**api:** …`). В режиме A scope на маршрутизацию по пакетам не влияет, в режиме B пакет определяется по путям файлов, а не по scope.
- Ссылки `closes #N` в CHANGELOG меняются на `refs #N`, чтобы merge release PR не закрывал issues ([default.ts](https://github.com/googleapis/release-please/blob/main/src/changelog-notes/default.ts)).
- Сам release PR называется `chore(main): release X.Y.Z` (паттерн по умолчанию `chore: release ${branch}` для группового PR, [manifest-releaser.md](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#configfile)). Это валидный Conventional Commit, commitlint `config-conventional` его пропустит.
- Рекомендуется squash-merge ([README → Linear git commit history](https://github.com/googleapis/release-please#linear-git-commit-history-use-squash-merge)). Для этого репозитория это ещё и требование `check.yml`: обычный merge-коммит «Merge pull request …» не пройдёт commitlint на push в `main`.
- Принудительная версия задаётся футером `Release-As: x.y.z` в теле коммита ([README](https://github.com/googleapis/release-please#how-do-i-change-the-version-number)).

## Взаимодействие с workflow

- GitHub Docs: «events triggered by the `GITHUB_TOKEN` will not create a new workflow run». Исключения: `workflow_dispatch`, `repository_dispatch`, а `pull_request` (`opened`/`synchronize`/`reopened`) создаёт запуск, ожидающий одобрения ([Triggering a workflow from a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)). README action говорит о том же ([Other Actions on Release Please PRs](https://github.com/googleapis/release-please-action#other-actions-on-release-please-prs)).
- `check.yml` (`on: push`, все ветки): push ветки release PR через `GITHUB_TOKEN` **не** запустит проверки. Merge release PR в `main` делает человек, и этот push проверки запустит, включая Prettier для изменённых `package.json` и `.release-please-manifest.json`. Корневой `CHANGELOG.md` под Prettier не попадает (`/*.md`).
- `hexlet-check.yml` (`push` на все ветки и теги): не сработает ни на ветку release PR, ни на тег `vX.Y.Z`, созданный `GITHUB_TOKEN`. Сработает на merge в `main`. Файл не меняется.
- Если CI нужен на самом release PR, нужен PAT или GitHub App-токен во входе `token` ([README → GitHub Credentials](https://github.com/googleapis/release-please-action#github-credentials)). Это новый секрет и более широкие права, сейчас не требуется.
- Триггер — `push` в `main`. Работа идёт в `setup/agent-environment`, и пока она не слита в `main`, release-please нечего обрабатывать. Нацелить его на `setup/agent-environment` через `target-branch` технически можно ([README → Supporting multiple release branches](https://github.com/googleapis/release-please-action#supporting-multiple-release-branches)), но смысла нет: релизы и теги должны относиться к `main`.

## Риски

- **Первый CHANGELOG будет длинным**: в него войдут все `feat`/`fix` из `setup/agent-environment` после merge в `main`. Ограничить можно через `bootstrap-sha`.
- **Отставание action**: v5.0.0 включает release-please 17.6.0, библиотека ушла до 17.11.2. Фиксы библиотеки приходят с задержкой. SHA обновлять вручную или через Dependabot.
- **Нет CI на release PR** при `GITHUB_TOKEN`: ошибку формата в `package.json` увидим только после merge в `main`.
- **`pnpm-lock.yaml` не обновляется** стратегией `node`. Сейчас это безопасно, но если `apps/*` начнут зависеть друг от друга через `workspace:`, режим B потребует проверки lock-файла.
- **Документация расходится с кодом** по начальной версии (0.1.0 в docs, 1.0.0 в коде). Поэтому `initial-version` стоит задать явно.
- **Настройка репозитория** «Allow GitHub Actions to create and approve pull requests» расширяет возможности всех workflow с правом `pull-requests: write`. Права остальных workflow стоит держать минимальными, как в `check.yml` (`contents: read`).

## Источники

- release-please-action README: https://github.com/googleapis/release-please-action#readme
- release-please-action `action.yml`: https://github.com/googleapis/release-please-action/blob/main/action.yml
- release-please-action releases (v5.0.0, v4.4.1): https://github.com/googleapis/release-please-action/releases
- GitHub API: `repos/googleapis/release-please-action/git/ref/tags/v5.0.0`, `…/tags/v5`, `…/git/tags/0dfd8538845b8e92600d271a895a5372865d4062`
- release-please README: https://github.com/googleapis/release-please#readme
- release-please releases: https://github.com/googleapis/release-please/releases
- Manifest releaser: https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md
- Config schema: https://github.com/googleapis/release-please/blob/main/schemas/config.json
- Strategy `node`: https://github.com/googleapis/release-please/blob/main/src/strategies/node.ts
- Strategy `simple`: https://github.com/googleapis/release-please/blob/main/src/strategies/simple.ts
- Base strategy: https://github.com/googleapis/release-please/blob/main/src/strategies/base.ts
- `package.json` updater: https://github.com/googleapis/release-please/blob/main/src/updaters/node/package-json.ts
- Changelog sections: https://github.com/googleapis/release-please/blob/main/src/util/filter-commits.ts
- Changelog notes: https://github.com/googleapis/release-please/blob/main/src/changelog-notes/default.ts
- Commit parsing: https://github.com/googleapis/release-please/blob/main/src/commit.ts
- GitHub Docs, triggering a workflow: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow
- GitHub Docs, Actions settings for a repository: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository
- GitHub Docs, secure use (SHA pinning): https://docs.github.com/en/actions/reference/security/secure-use
- Настройки репозитория: `gh api repos/Aleksandra-korza/frontend-project-386/actions/permissions/workflow`
