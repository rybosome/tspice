import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import eslintConfigPrettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'playwright-report/'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Keep linting focused on correctness over strict typing in this app.
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // React (viewer runtime code)
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // React 17+ JSX transform.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',

      // TS already checks props.
      'react/prop-types': 'off',

      // Too noisy for copy-heavy UI.
      'react/no-unescaped-entities': 'off',

      // Useful, but can be noisy in complex hooks; keep it opt-in for now.
      'react-hooks/exhaustive-deps': 'off',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Node / tooling files.
  {
    files: ['vite.config.ts', 'playwright.config.ts', 'e2e/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },

  // Disable any stylistic rules that might conflict with Prettier.
  eslintConfigPrettier,
]
