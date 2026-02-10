import { spawnSync } from "node:child_process";

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const env = {
  ...process.env,
  // Ensure the parity suite fails (instead of silently skipping) if cspice-runner
  // isn't available.
  TSPICE_BACKEND_VERIFY_REQUIRED: process.env.TSPICE_BACKEND_VERIFY_REQUIRED ?? "true",
};

const res = spawnSync(pnpmCmd, ["-C", "packages/backend-verify", "test"], {
  stdio: "inherit",
  env,
});

process.exit(res.status ?? 1);
