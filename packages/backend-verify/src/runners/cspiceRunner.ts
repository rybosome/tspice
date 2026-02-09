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
  return fs.existsSync(getCspiceRunnerBinaryPath());
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

export type InvokeRunnerOptions = {
  /**
   * Hard timeout for the child process (ms).
   *
   * Note: tests override this to keep runtimes bounded.
   */
  timeoutMs?: number;
  maxStdoutChars?: number;
  maxStderrChars?: number;
  args?: string[];
};

/** @internal (exported for bounded-time tests) */
export async function invokeRunner(
  binaryPath: string,
  input: RunCaseInput,
  opts: InvokeRunnerOptions = {},
): Promise<CRunnerResponse> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxStdoutChars = opts.maxStdoutChars ?? 1_000_000;
  const maxStderrChars = opts.maxStderrChars ?? 1_000_000;
  const args = opts.args ?? [];

  const preview = (s: string, maxChars: number): string => {
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}… (+${s.length - maxChars} chars)`;
  };

  return await new Promise((resolve, reject) => {
    let settled = false;

    const child = spawn(binaryPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    type TeardownMode = "graceful" | "abort";

    const cleanup = (mode: TeardownMode) => {
      // Avoid keeping the event loop alive after we've already settled.
      try {
        child.stdout.removeAllListeners();
        child.stderr.removeAllListeners();
        child.removeAllListeners();
      } catch {
        // ignore
      }

      // Best-effort: close stdin so the parent doesn't hang on pending writes.
      try {
        child.stdin.destroy();
      } catch {
        // ignore
      }

      // On abort paths we may have SIGKILLed the child (or otherwise stopped
      // caring about its output); force-close the readable streams.
      if (mode === "abort") {
        try {
          child.stdout.destroy();
        } catch {
          // ignore
        }
        try {
          child.stderr.destroy();
        } catch {
          // ignore
        }
      }
    };

    const finish = (mode: TeardownMode, fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup(mode);
      fn();
    };

    const timer = setTimeout(() => {
      // Best-effort: kill the child.
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      finish("abort", () =>
        reject(
          new Error(
            [
              `cspice-runner timed out after ${timeoutMs}ms`,
              `stdout=${JSON.stringify(preview(stdout, 4_000))}${stdoutTruncated ? " (truncated)" : ""}`,
              `stderr=${JSON.stringify(preview(stderr, 4_000))}${stderrTruncated ? " (truncated)" : ""}`,
            ].join(" "),
          ),
        ),
      );
    }, timeoutMs);
    timer.unref?.();

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
      const justTruncated = !stdoutTruncated && r.truncated;
      stdoutTruncated ||= r.truncated;

      // If stdout truncates, the JSON will no longer parse; bail early.
      if (justTruncated) {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }

        finish("abort", () =>
          reject(
            new Error(
              [
                `cspice-runner output exceeded limit (stdout capped at ${maxStdoutChars} chars)`,
                `stdout=${JSON.stringify(preview(stdout, 4_000))} (truncated)`,
                `stderr=${JSON.stringify(preview(stderr, 4_000))}${stderrTruncated ? " (truncated)" : ""}`,
              ].join(" "),
            ),
          ),
        );
      }
    });
    child.stderr.on("data", (chunk) => {
      const r = appendCapped(stderr, chunk, maxStderrChars);
      stderr = r.next;
      const justTruncated = !stderrTruncated && r.truncated;
      stderrTruncated ||= r.truncated;

      // If stderr truncates, error messages can become enormous; bail early.
      if (justTruncated) {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }

        finish("abort", () =>
          reject(
            new Error(
              [
                `cspice-runner output exceeded limit (stderr capped at ${maxStderrChars} chars)`,
                `stdout=${JSON.stringify(preview(stdout, 4_000))}${stdoutTruncated ? " (truncated)" : ""}`,
                `stderr=${JSON.stringify(preview(stderr, 4_000))} (truncated)`,
              ].join(" "),
            ),
          ),
        );
      }
    });

    child.on("error", (err) => {
      finish("abort", () => reject(err));
    });

    child.on("close", (code, signal) => {
      finish("graceful", () => {
        const out = stdout.trim();
        const err = stderr.trim();

        if (code !== 0 || signal) {
          reject(
            new Error(
              [
                `cspice-runner exited non-zero (code=${code}, signal=${signal}).`,
                `stdout=${JSON.stringify(preview(out, 4_000))}${stdoutTruncated ? " (truncated)" : ""}`,
                `stderr=${JSON.stringify(preview(err, 4_000))}${stderrTruncated ? " (truncated)" : ""}`,
              ].join(" "),
            ),
          );
          return;
        }

        if (!out) {
          reject(
            new Error(
              [
                `cspice-runner produced no JSON output (code=${code}, signal=${signal}).`,
                `stdout=${JSON.stringify(preview(out, 4_000))}${stdoutTruncated ? " (truncated)" : ""}`,
                `stderr=${JSON.stringify(preview(err, 4_000))}${stderrTruncated ? " (truncated)" : ""}`,
              ].join(" "),
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
              [
                `Failed to parse cspice-runner JSON output (code=${code}, signal=${signal}).`,
                `stdout=${JSON.stringify(preview(out, 4_000))}${stdoutTruncated ? " (truncated)" : ""}`,
                `stderr=${JSON.stringify(preview(err, 4_000))}${stderrTruncated ? " (truncated)" : ""}`,
              ].join(" "),
            ),
          );
        }
      });
    });

    // If we can't write the request payload to the child (e.g. broken pipe),
    // treat that as a hard failure.
    child.stdin.on("error", (err) => {
      finish("abort", () => reject(err));
    });

    try {
      child.stdin.end(`${JSON.stringify(input)}\n`);
    } catch (err) {
      finish(
        "abort",
        () =>
          reject(
            err instanceof Error
              ? err
              : new Error(`Failed to write request to cspice-runner stdin: ${String(err)}`),
          ),
      );
    }
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
