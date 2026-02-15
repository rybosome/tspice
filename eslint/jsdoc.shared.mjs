/**
* Shared configuration for JSDoc linting.
*
* Keep these as the single source of truth so rule options + file scopes don't
* drift between the root JSDoc-only pass and app/package ESLint configs.
*/

/**
* Globs for the repo-wide JSDoc-only lint pass.
*
* Note: Keep this aligned with the root `eslint.config.mjs` `files` scope.
*/
export const JSDOC_SOURCE_FILES = [
  '{packages/*/src,fixtures/*/src,apps/*/src,apps/docs}/**/*.{ts,tsx,mts,cts}',
]

/**
* Shared `jsdoc/require-jsdoc` rule options.
*/
export const REQUIRE_JSDOC_RULE = [
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

    // Require docs for interface APIs without accidentally flagging
    // function-like properties inside type literals.
    contexts: ['TSInterfaceDeclaration', 'TSInterfaceDeclaration > TSInterfaceBody > TSMethodSignature'],

    // Requiring constructor docs tends to add noise; prefer class-level docs.
    checkConstructors: false,
  },
]
