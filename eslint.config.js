// @ts-check
import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import { reactRefresh } from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// typescript-eslint пока не поддерживает API TypeScript 7, поэтому
// в корневом package.json пакет `typescript` — алиас на @typescript/typescript6
// (рецепт из анонса TypeScript 7.0). Сборка и typecheck в apps/* используют TS 7.
export default defineConfig([
  globalIgnores([
    '**/dist/',
    '**/coverage/',
    '**/.vitest/',
    // Сгенерированные SDK frontend и типы backend (mise run codegen) — не редактируются вручную.
    'apps/frontend/src/client/',
    'apps/backend/src/generated/',
    // Артефакты Playwright (mise run e2e).
    '**/test-results/',
    '**/playwright-report/',
    '**/blob-report/',
  ]),

  {
    name: 'project/base',
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          // Корневые конфиги не входят ни в один tsconfig.
          allowDefaultProject: ['*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    // JS-файлы (этот конфиг) не входят в tsconfig — для них без правил, требующих типов.
    name: 'project/js-untyped',
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    name: 'project/backend',
    files: ['apps/backend/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    name: 'project/frontend',
    files: ['apps/frontend/**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      // buttonVariants — стандартный экспорт компонента shadcn/ui Button,
      // его импортируют другие компоненты shadcn.
      reactRefresh.configs.vite({ allowExportNames: ['buttonVariants'] }),
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },

  {
    name: 'project/e2e',
    files: ['e2e/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    name: 'project/node-configs',
    files: ['*.{js,ts}', 'apps/*/*.{js,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Отключает правила, конфликтующие с Prettier. Должен быть последним.
  eslintConfigPrettier,
])
