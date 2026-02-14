import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsdoc from 'eslint-plugin-jsdoc'
import eslintConfigPrettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'playwright-report/'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // E2E tests run in a mixed Node/browser context; allow `any` where needed.
  {
    files: ['e2e/**/*.ts'],
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

      // Important correctness check for hooks.
      'react-hooks/exhaustive-deps': 'error',

      // Keep `any` scoped to tests/tooling only.
      '@typescript-eslint/no-explicit-any': 'error',

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

  // Enforce JSDoc on exported/public surface only.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      jsdoc,
    },
    rules: {
      'jsdoc/check-alignment': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: {
            ancestorsOnly: true,
          },
          require: {
            ArrowFunctionExpression: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ClassExpression: true,
          },
          contexts: ['TSInterfaceDeclaration', 'TSMethodSignature'],
        },
      ],
    },
  },
]
