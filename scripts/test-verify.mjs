import { spawnSync } from "node:child_process";

import { getCspiceRunnerStatus } from "../packages/backend-verify/scripts/cspice-runner-status.mjs";

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const requiredDefault = process.env.CI ? "true" : "false";
const required = process.env.TSPICE_BACKEND_VERIFY_REQUIRED ?? requiredDefault;

if (required === "false") {
  const { ready, hint } = getCspiceRunnerStatus();
  if (!ready) {
    // eslint-disable-next-line no-console
    console.warn(
      `[test-verify] cspice-runner unavailable; backend-verify parity suite may be skipped (TSPICE_BACKEND_VERIFY_REQUIRED=false): ${hint}`,
    );
  }
}

const env = {
  ...process.env,
  // Ensure the parity suite fails (instead of silently skipping) if cspice-runner
  // isn't available.
  TSPICE_BACKEND_VERIFY_REQUIRED: required,
};

const res = spawnSync(pnpmCmd, ["-C", "packages/backend-verify", "test"], {
  stdio: "inherit",
  env,
});

process.exit(res.status ?? 1);
