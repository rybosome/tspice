import tsParser from '@typescript-eslint/parser'
import tseslint from '@typescript-eslint/eslint-plugin'
import jsdoc from 'eslint-plugin-jsdoc'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
    ],
    // This repo has inline disables for other eslint configs (e.g. app-specific linting).
    // Our goal here is JSDoc formatting only; don't delete/flag disables as "unused".
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      jsdoc,
    },
    rules: {
      'jsdoc/check-alignment': 'error',
    },
  },
]
