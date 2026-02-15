import jsdoc from 'eslint-plugin-jsdoc'
import tseslint from 'typescript-eslint'

import { JSDOC_SOURCE_FILES, REQUIRE_JSDOC_RULE } from './eslint/jsdoc.shared.mjs'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',

      // Generated typings.
      '**/*.d.ts',
    ],
  },

  {
    files: JSDOC_SOURCE_FILES,

    // This repo has inline disables for other eslint configs (e.g. app-specific linting).
    // Our goal here is JSDoc enforcement/formatting only; don't flag disables as "unused".
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },

    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    plugins: {
      jsdoc,
      // Register the plugin so existing `eslint-disable @typescript-eslint/...` comments remain valid.
      '@typescript-eslint': tseslint.plugin,
    },

    rules: {
      'jsdoc/check-alignment': 'error',
      'jsdoc/require-jsdoc': REQUIRE_JSDOC_RULE,
    },
  },
]
