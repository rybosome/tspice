import { spawnSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const requiredDefault = process.env.CI ? "true" : "false";
const required = process.env.TSPICE_BACKEND_VERIFY_REQUIRED ?? requiredDefault;

if (required === "false") {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const exeExt = process.platform === "win32" ? ".exe" : "";
  const runnerPath = path.join(
    rootDir,
    "packages",
    "backend-verify",
    "native",
    "build",
    `cspice-runner${exeExt}`,
  );
  const statePath = path.join(
    rootDir,
    "packages",
    "backend-verify",
    "native",
    "build",
    "cspice-runner.state.json",
  );

  let hint = "";
  let stateAvailable;

  try {
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      hint = typeof state?.reason === "string" ? state.reason : typeof state?.error === "string" ? state.error : "";
      if (typeof state?.available === "boolean") stateAvailable = state.available;
    }
  } catch {
    // ignore
  }

  const runnerOk =
    stateAvailable === undefined ? fs.existsSync(runnerPath) : stateAvailable && fs.existsSync(runnerPath);

  if (!runnerOk) {
    // eslint-disable-next-line no-console
    console.warn(
      `[test-verify] cspice-runner unavailable; backend-verify parity suite may be skipped (TSPICE_BACKEND_VERIFY_REQUIRED=false)${
        hint ? `: ${hint}` : ""
      }`,
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
