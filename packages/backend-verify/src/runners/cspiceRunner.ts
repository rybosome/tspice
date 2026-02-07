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
  const bin = getCspiceRunnerBinaryPath();
  // Binary existence should be the source of truth; the build state file can be stale.
  if (fs.existsSync(bin)) return true;

  const state = readCspiceRunnerBuildState();
  if (state && state.available === false) return false;

  return false;
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
  const timeoutMs = 15_000;
  const maxStdoutChars = 1_000_000;
  const maxStderrChars = 1_000_000;

  return await new Promise((resolve, reject) => {
    let settled = false;

    const child = spawn(binaryPath, [], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      // Best-effort: kill the child; `close` should follow.
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, timeoutMs);

    const appendCapped = (
      prev: string,
      chunk: string,
      maxChars: number,
    ): { next: string; truncated: boolean } => {
      if (prev.length >= maxChars) {
        return { next: prev, truncated: true };
      }
      const remaining = maxChars - prev.length;
      if (chunk.length <= remaining) {
        return { next: prev + chunk, truncated: false };
      }
      return { next: prev + chunk.slice(0, remaining), truncated: true };
    };

    child.stdout.on("data", (chunk) => {
      const r = appendCapped(stdout, chunk, maxStdoutChars);
      stdout = r.next;
      stdoutTruncated ||= r.truncated;

      // If stdout truncates, the JSON will no longer parse; bail early.
      if (stdoutTruncated) {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      const r = appendCapped(stderr, chunk, maxStderrChars);
      stderr = r.next;
      stderrTruncated ||= r.truncated;
    });

    child.on("error", (err) => {
      finish(() => reject(err));
    });

    child.on("close", (code, signal) => {
      finish(() => {
        if (stdoutTruncated) {
          reject(
            new Error(
              `cspice-runner output exceeded limit (stdout capped at ${maxStdoutChars} chars). code=${code} signal=${signal} stderr=${stderrTruncated ? "(truncated)" : JSON.stringify(stderr.trim())}`,
            ),
          );
          return;
        }

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
        } catch {
          reject(
            new Error(
              `Failed to parse cspice-runner JSON output. stdout=${JSON.stringify(out)} stderr=${JSON.stringify(stderr.trim())}`,
            ),
          );
        }
      });
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
