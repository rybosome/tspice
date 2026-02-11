import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

function packageRoot() {
  // packages/backend-verify/scripts -> packages/backend-verify
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

function exeExt() {
  return process.platform === "win32" ? ".exe" : "";
}

function getCspiceRunnerBinaryPath() {
  return path.join(packageRoot(), "native", "build", `cspice-runner${exeExt()}`);
}

function getCspiceRunnerBuildStatePath() {
  return path.join(packageRoot(), "native", "build", "cspice-runner.state.json");
}

function readCspiceRunnerBuildState() {
  const p = getCspiceRunnerBuildStatePath();
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isCspiceRunnerAvailable() {
  const binaryPath = getCspiceRunnerBinaryPath();
  if (!fs.existsSync(binaryPath)) return false;

  // Prefer the pretest state file when present so we don't accidentally run with
  // a stale/broken binary.
  const state = readCspiceRunnerBuildState();
  if (state && state.available === false) return false;

  return true;
}

export function getCspiceRunnerStatus() {
  const statePath = getCspiceRunnerBuildStatePath();
  const ready = isCspiceRunnerAvailable();
  const state = readCspiceRunnerBuildState();
  const hint = ready
    ? ""
    : state?.reason?.trim?.()
      ? state.reason
      : state?.error?.trim?.()
        ? state.error
        : `State: ${statePath}`;
  return { ready, hint, statePath };
}
