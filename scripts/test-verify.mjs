import { spawnSync } from "node:child_process";

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const requiredDefault = process.env.CI ? "true" : "false";
const required = process.env.TSPICE_BACKEND_VERIFY_REQUIRED ?? requiredDefault;

if (required === "false") {
  // Avoid duplicating cspice-runner status logic in this repo-level script.
  // Build backend-verify so we can import the canonical helper.
  const build = spawnSync(pnpmCmd, ["-C", "packages/backend-verify", "build"], {
    stdio: "inherit",
  });
  if ((build.status ?? 1) !== 0) {
    process.exit(build.status ?? 1);
  }

  const { getCspiceRunnerStatus } = await import(
    "../packages/backend-verify/dist/runners/cspiceRunner.js"
  );

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
