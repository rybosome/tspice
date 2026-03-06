#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

const generatedFiles = [
  "packages/parity-checking/catalogs/contract-methods.json",
  "packages/parity-checking/catalogs/parity-denylist.json",
  "packages/parity-checking/catalogs/parity-denylist.ts",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

function resolveRepoRoot(startCwd) {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: startCwd,
    encoding: "utf8",
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }

  const repoRoot = result.stdout?.trim();
  if (!repoRoot) {
    console.error("[parity-checking] failed to resolve git repo root");
    process.exit(1);
  }

  return repoRoot;
}

const repoRoot = resolveRepoRoot(packageRoot);

run(pnpmCmd, ["run", "generate:catalogs"], { cwd: packageRoot });

const missingGeneratedFiles = generatedFiles.filter(
  (relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)),
);

if (missingGeneratedFiles.length > 0) {
  for (const relativePath of missingGeneratedFiles) {
    console.error(`[parity-checking] missing generated file: ${relativePath}`);
  }
  process.exit(1);
}

run("git", [
  "diff",
  "--exit-code",
  "--",
  ...generatedFiles,
], { cwd: repoRoot });
