import { spawnSync } from "node:child_process";

const PNPM_CMD = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (typeof result.status === "number") {
    return result.status;
  }

  if (result.error) {
    throw result.error;
  }

  return 1;
}

const pretestExitCode = run(PNPM_CMD, ["run", "--if-present", "pretest"]);
if (pretestExitCode !== 0) {
  process.exit(pretestExitCode);
}

const vitestArgs = [
  "exec",
  "vitest",
  "run",
  "--coverage",
  "--coverage.provider=v8",
  "--coverage.reporter=text-summary",
  "--coverage.reporter=json-summary",
  "--coverage.reporter=lcov",
  "--coverage.reportsDirectory=coverage",
  ...process.argv.slice(2),
];

const vitestExitCode = run(PNPM_CMD, vitestArgs);
process.exit(vitestExitCode);
