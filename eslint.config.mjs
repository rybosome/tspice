import jsdoc from 'eslint-plugin-jsdoc'
import tseslint from 'typescript-eslint'

const SOURCE_FILES = ['{packages/*/src,fixtures/*/src,apps/docs}/**/*.{ts,tsx,mts,cts}']

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
    files: SOURCE_FILES,

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
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: {
            ancestorsOnly: true,
          },

          // Catch common exported callables (including `export const fn = () => {}`).
          require: {
            ArrowFunctionExpression: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ClassExpression: true,
          },

          // Require docs for interface APIs (e.g. backend-contract) without
          // accidentally flagging function-like properties inside type literals.
          contexts: ['TSInterfaceDeclaration', 'TSInterfaceDeclaration > TSInterfaceBody > TSMethodSignature'],

          // Requiring constructor docs tends to add noise; prefer class-level docs.
          checkConstructors: false,
        },
      ],
    },
  },
]
