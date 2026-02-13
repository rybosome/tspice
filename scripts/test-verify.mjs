import { spawnSync } from "node:child_process";

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const requiredDefault = process.env.CI ? "true" : "false";
const required = process.env.TSPICE_BACKEND_VERIFY_REQUIRED ?? requiredDefault;

const env = {
  ...process.env,
  TSPICE_BACKEND_VERIFY_REQUIRED: required,
};

const res = spawnSync(pnpmCmd, ["-C", "packages/backend-verify", "test"], {
  stdio: "inherit",
  env,
});

process.exit(res.status ?? 1);
