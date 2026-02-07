import * as path from "node:path";
import * as fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import type {
  CaseRunner,
  RunCaseInput,
  RunCaseResult,
  RunnerErrorReport,
  SpiceErrorState,
} from "./types.js";

export type CspiceRunnerBuildState = {
  available: boolean;
  reason?: string;
  error?: string;
  binaryPath?: string;
  cspiceDir?: string;
  rebuilt?: boolean;
  reused?: boolean;
};

function packageRoot(): string {
  // Works for both src/ and dist/ layouts.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function exeExt(): string {
  return process.platform === "win32" ? ".exe" : "";
}

export function getCspiceRunnerBinaryPath(): string {
  return path.join(packageRoot(), "native", "build", `cspice-runner${exeExt()}`);
}

export function getCspiceRunnerBuildStatePath(): string {
  return path.join(packageRoot(), "native", "build", "cspice-runner.state.json");
}

export function readCspiceRunnerBuildState(): CspiceRunnerBuildState | null {
  const p = getCspiceRunnerBuildStatePath();
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as CspiceRunnerBuildState;
  } catch {
    return null;
  }
}

export function isCspiceRunnerAvailable(): boolean {
  const state = readCspiceRunnerBuildState();
  if (state && state.available === false) return false;

  const bin = getCspiceRunnerBinaryPath();
  return fs.existsSync(bin);
}

function safeErrorReport(error: unknown): RunnerErrorReport {
  if (error instanceof Error) {
    const report: RunnerErrorReport = { message: error.message };
    if (error.name) report.name = error.name;
    if (error.stack) report.stack = error.stack;
    return report;
  }

  return { message: String(error) };
}

type CRunnerOk = { ok: true; result: unknown };

type CRunnerError = {
  ok: false;
  error: {
    message: string;
    spiceShort?: string;
    spiceLong?: string;
    spiceTrace?: string;
  };
};

type CRunnerResponse = CRunnerOk | CRunnerError;

async function invokeRunner(binaryPath: string, input: RunCaseInput): Promise<CRunnerResponse> {
  return await new Promise((resolve, reject) => {
    const child = spawn(binaryPath, [], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code, signal) => {
      const out = stdout.trim();

      if (!out) {
        reject(
          new Error(
            `cspice-runner produced no JSON output (code=${code}, signal=${signal}, stderr=${stderr.trim()})`,
          ),
        );
        return;
      }

      try {
        const parsed = JSON.parse(out) as CRunnerResponse;
        resolve(parsed);
      } catch (e) {
        reject(
          new Error(
            `Failed to parse cspice-runner JSON output. stdout=${JSON.stringify(out)} stderr=${JSON.stringify(stderr.trim())}`,
          ),
        );
      }
    });

    child.stdin.end(`${JSON.stringify(input)}\n`);
  });
}

function asSpiceErrorState(err: CRunnerError["error"]): SpiceErrorState {
  const spice: SpiceErrorState = { failed: true };
  if (err.spiceShort) spice.short = err.spiceShort;
  if (err.spiceLong) spice.long = err.spiceLong;
  if (err.spiceTrace) spice.trace = err.spiceTrace;
  return spice;
}

export async function createCspiceRunner(): Promise<CaseRunner> {
  const binaryPath = getCspiceRunnerBinaryPath();

  return {
    kind: "cspice(raw)",

    async runCase(input: RunCaseInput): Promise<RunCaseResult> {
      if (!fs.existsSync(binaryPath)) {
        return {
          ok: false,
          error: {
            message: `cspice-runner binary not found: ${binaryPath} (run: pnpm -C packages/backend-verify test)`,
          },
        };
      }

      try {
        const out = await invokeRunner(binaryPath, input);
        if (out.ok) {
          return { ok: true, result: out.result };
        }

        const report: RunnerErrorReport = {
          message: out.error.message,
          spice: asSpiceErrorState(out.error),
        };
        return { ok: false, error: report };
      } catch (error) {
        return { ok: false, error: safeErrorReport(error) };
      }
    },
  };
}
