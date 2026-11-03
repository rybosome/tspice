import path from "node:path";
import { execFileSync } from "node:child_process";

// Generated outputs belong to their generators, never to format/lint --write.
export const GENERATED_FILES = new Set([
  "pnpm-lock.yaml",
  "docs/cspice-function-inventory.md",
  "data/coverage-ledger.json",
  "docs/coverage-ledger.md",
  "apps/docs/guide/kernel-inventory.md",
  "apps/docs/public/tspice.schema.json",
  "packages/tspice/src/kernels/naifKernelId.ts",
]);
export const EXCLUDED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "dist-publish",
  "build",
  "generated",
  "emscripten",
  ".cache",
  ".turbo",
  "coverage",
  "playwright-report",
  "__pycache__",
]);
const CODE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);
const FORMAT_EXTENSIONS = new Set([
  ...CODE_EXTENSIONS,
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".md",
  ".css",
  ".html",
  ".vue",
]);

export function selectQualityFiles(paths, kind) {
  if (kind !== "format" && kind !== "lint")
    throw new Error(`Unknown quality check: ${kind}`);
  const extensions = kind === "format" ? FORMAT_EXTENSIONS : CODE_EXTENSIONS;
  return [...new Set(paths)]
    .filter((file) => {
      const parts = file.split("/");
      return (
        extensions.has(path.posix.extname(file)) &&
        !parts.some((part) => EXCLUDED_DIRECTORIES.has(part)) &&
        !file.startsWith("apps/docs/api/reference/") &&
        !GENERATED_FILES.has(file)
      );
    })
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function trackedQualityFiles(repoRoot, kind) {
  const tracked = execFileSync("git", ["ls-files", "--cached", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  const files = selectQualityFiles(tracked, kind);
  if (files.length === 0)
    throw new Error(
      `No tracked ${kind} files were selected; refusing an empty quality gate.`,
    );
  return files;
}
