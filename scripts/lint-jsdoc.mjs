import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { ESLint } from 'eslint'

import { JSDOC_SOURCE_FILES } from '../eslint/jsdoc.shared.mjs'

const fix = process.argv.includes('--fix')

const eslintConfigPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../eslint.config.mjs',
)

try {
  const eslint = new ESLint({
    fix,
    overrideConfigFile: eslintConfigPath,
  })

  const results = await eslint.lintFiles(JSDOC_SOURCE_FILES)

  if (fix) {
    await ESLint.outputFixes(results)
  }

  const formatter = await eslint.loadFormatter('stylish')
  const output = formatter.format(results)

  if (output) {
    process.stdout.write(output)
  }

  const errorCount = results.reduce((sum, result) => sum + result.errorCount, 0)
  const warningCount = results.reduce((sum, result) => sum + result.warningCount, 0)

  // Match `--max-warnings 0`: fail if there are *any* warnings.
  if (errorCount > 0 || warningCount > 0) {
    process.exitCode = 1
  }
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(error)
  process.exitCode = 1
}
