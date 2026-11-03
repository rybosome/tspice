import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import * as prettier from "prettier";
import eslintConfig from "../eslint.config.mjs";
import { trackedQualityFiles } from "./quality-files.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export async function runQualityCheck({
  kind,
  root = repoRoot,
  write = false,
  log = console.log,
}) {
  if (write && kind !== "format")
    throw new Error("--write is supported only by format.");
  const files = trackedQualityFiles(root, kind);
  log(`${kind}: checking ${files.length} tracked files`);
  if (kind === "format") {
    const options = JSON.parse(
      await readFile(path.join(repoRoot, ".prettierrc.json"), "utf8"),
    );
    const violations = [];
    for (const file of files) {
      const absolute = path.join(root, file);
      const input = await readFile(absolute, "utf8");
      const formatted = await prettier.format(input, {
        ...options,
        filepath: absolute,
      });
      if (formatted !== input) {
        if (write) await writeFile(absolute, formatted);
        else violations.push(file);
      }
    }
    if (violations.length > 0)
      throw new Error(
        `Formatting differs in ${violations.length} file(s):\n${violations.join("\n")}\nRun pnpm format.`,
      );
  } else {
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: eslintConfig,
    });
    for (const file of files) {
      if (await eslint.isPathIgnored(path.join(root, file))) {
        throw new Error(
          `Selected lint file is ignored by ESLint: ${file}; reconcile the file inventory and config.`,
        );
      }
    }
    const results = await eslint.lintFiles(
      files.map((file) => path.join(root, file)),
    );
    if (results.length !== files.length)
      throw new Error(
        `ESLint evaluated ${results.length}/${files.length} selected files.`,
      );
    const formatter = await eslint.loadFormatter("stylish");
    const output = formatter.format(results);
    if (output) log(output);
    const problemCount = results.reduce(
      (total, result) => total + result.errorCount + result.warningCount,
      0,
    );
    if (problemCount > 0)
      throw new Error(`Lint found ${problemCount} error(s) or warning(s).`);
  }
  log(
    `${kind}: ${files.length} tracked files passed${write ? " (formatted where needed)" : ""}`,
  );
  return files.length;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [kind, ...args] = process.argv.slice(2);
  try {
    if (
      !["format", "lint"].includes(kind) ||
      args.some((arg) => arg !== "--write") ||
      args.length > 1
    ) {
      throw new Error(
        "Usage: node scripts/quality-check.mjs format [--write] | lint",
      );
    }
    await runQualityCheck({ kind, write: args.includes("--write") });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
