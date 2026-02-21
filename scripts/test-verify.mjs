import { spawnSync } from "node:child_process";

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const res = spawnSync(pnpmCmd, ["-C", "packages/parity-checking", "test"], {
  stdio: "inherit",
  env: process.env,
});

process.exit(res.status ?? 1);
