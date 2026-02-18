#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(pnpmCmd, ["run", "generate:catalogs"]);
run("git", [
  "diff",
  "--exit-code",
  "--",
  "packages/parity-checking/catalogs/contract-methods.json",
  "packages/parity-checking/catalogs/alias-map.json",
  "packages/parity-checking/catalogs/parity-denylist.json",
  "packages/parity-checking/catalogs/parity-denylist.ts",
]);
