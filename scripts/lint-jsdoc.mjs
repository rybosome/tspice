import process from "node:process";

import { ESLint } from "eslint";

import { JSDOC_CONFIG, JSDOC_SOURCE_FILES } from "../eslint.config.mjs";

const fix = process.argv.includes("--fix");

try {
  const eslint = new ESLint({
    fix,
    overrideConfigFile: true,
    overrideConfig: [
      ...JSDOC_CONFIG,
      { linterOptions: { reportUnusedDisableDirectives: "off" } },
    ],
  });

  const results = await eslint.lintFiles(JSDOC_SOURCE_FILES);

  if (fix) {
    await ESLint.outputFixes(results);
  }

  const formatter = await eslint.loadFormatter("stylish");
  const output = formatter.format(results);

  if (output) {
    process.stdout.write(output);
  }

  const errorCount = results.reduce(
    (sum, result) => sum + result.errorCount,
    0,
  );
  const warningCount = results.reduce(
    (sum, result) => sum + result.warningCount,
    0,
  );

  // Match `--max-warnings 0`: fail if there are *any* warnings.
  if (errorCount > 0 || warningCount > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
