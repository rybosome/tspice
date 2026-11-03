import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";
import {
  EXCLUDED_DIRECTORIES,
  GENERATED_FILES,
} from "./scripts/quality-files.mjs";

export const JSDOC_SOURCE_FILES = [
  "{packages/*/src,fixtures/*/src,apps/*/src,apps/docs}/**/*.{ts,tsx,mts,cts}",
];
export const REQUIRE_JSDOC_RULE = [
  "error",
  {
    publicOnly: { ancestorsOnly: true },
    require: {
      ArrowFunctionExpression: true,
      FunctionDeclaration: true,
      FunctionExpression: true,
      MethodDefinition: true,
      ClassDeclaration: true,
      ClassExpression: true,
    },
    contexts: [
      "TSInterfaceDeclaration",
      "TSInterfaceDeclaration > TSInterfaceBody > TSMethodSignature",
    ],
    checkConstructors: false,
  },
];
const sourceFiles = ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"];
const typescriptFiles = ["**/*.{ts,tsx,mts,cts}"];
const ignores = [
  ...[...EXCLUDED_DIRECTORIES].map((directory) => `**/${directory}/**`),
  ...GENERATED_FILES,
  "apps/docs/api/reference/**",
];

export const JSDOC_CONFIG = [
  { ignores },
  {
    files: JSDOC_SOURCE_FILES,
    languageOptions: { parser: tseslint.parser },
    plugins: { jsdoc, "@typescript-eslint": tseslint.plugin },
    rules: {
      "jsdoc/check-alignment": "error",
      "jsdoc/require-jsdoc": REQUIRE_JSDOC_RULE,
    },
  },
];

export default [
  { ignores },
  { ...js.configs.recommended, files: sourceFiles },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: typescriptFiles,
  })),
  {
    files: sourceFiles,
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: typescriptFiles,
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/test/**", "**/*.test.{js,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      // Runtime validation tests intentionally pass values outside the contract.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  ...JSDOC_CONFIG,
  prettier,
];
