import * as path from "node:path";
import * as fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import type {
  CaseRunner,
  KernelEntry,
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

function kernelEntryPath(entry: KernelEntry): string {
  return typeof entry === "string" ? entry : entry.path;
}

/** @internal (exported for tests) */
export function fixturePackCwdFromKernels(kernels: KernelEntry[] | undefined): string | undefined {
  if (!kernels) return undefined;

  // Fixture-pack meta-kernels use PATH_VALUES=("."), which CSPICE resolves relative
  // to the process cwd when furnishing the meta-kernel.
  const dirs = new Set<string>();
  for (const k of kernels) {
    if (typeof k !== "string" && k.restrictToDir && path.extname(k.path).toLowerCase() === ".tm") {
      dirs.add(k.restrictToDir);
    }
  }

  if (dirs.size > 1) {
    const list = [...dirs].sort();
    throw new Error(
      `Multiple fixture packs were detected for this case; unable to choose a single cwd for CSPICE. ` +
        `Either load kernels from exactly one fixture pack, or provide explicit PATH_VALUES in a single meta-kernel. ` +
        `packs=${JSON.stringify(list)}`,
    );
  }

  if (dirs.size !== 1) return undefined;
  return [...dirs][0];
}

function normalizeInputForNativeRunner(input: RunCaseInput): RunCaseInput {
  const kernels = input.setup?.kernels;
  if (!kernels) return input;
  return { ...input, setup: { ...input.setup, kernels: kernels.map(kernelEntryPath) } };
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

function isCRunnerResponse(value: unknown): value is CRunnerResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.ok !== "boolean") return false;

  if (v.ok === true) {
    return "result" in v;
  }

  if (!("error" in v)) return false;
  const err = v.error;
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  return typeof e.message === "string";
}

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
  cwd?: string;
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
      cwd: opts.cwd,
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
          // The runner may still emit a structured JSON response (especially
          // { ok:false, error:{...} }). Prefer returning that response when
          // possible so callers get rich error details.
          if (out) {
            try {
              const parsed = JSON.parse(out) as unknown;
              if (isCRunnerResponse(parsed)) {
                resolve(parsed);
                return;
              }
            } catch {
              // fall through to generic error
            }
          }

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
          const parsed = JSON.parse(out) as unknown;
          if (!isCRunnerResponse(parsed)) {
            reject(
              new Error(
                [
                  `cspice-runner returned JSON, but it did not match the expected protocol shape (code=${code}, signal=${signal}).`,
                  `stdout=${JSON.stringify(preview(out, 4_000))}${stdoutTruncated ? " (truncated)" : ""}`,
                  `stderr=${JSON.stringify(preview(err, 4_000))}${stderrTruncated ? " (truncated)" : ""}`,
                ].join(" "),
              ),
            );
            return;
          }
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
        const cwd = fixturePackCwdFromKernels(input.setup?.kernels);
        const invokeOpts = cwd === undefined ? {} : { cwd };
        const out = await invokeRunner(binaryPath, normalizeInputForNativeRunner(input), invokeOpts);
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
