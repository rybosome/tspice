import { createBackend, type SpiceBackend } from "@rybosome/tspice";

import type { CaseRunner, RunCaseInput, RunCaseResult, RunnerErrorReport, SpiceErrorState } from "./types.js";

type DispatchFn = (backend: SpiceBackend, args: unknown[]) => unknown;

const DISPATCH: Record<string, DispatchFn> = {
  // Phase A minimum surface.
  "time.str2et": (backend, args) => {
    if (typeof args[0] !== "string") {
      throw new TypeError(`time.str2et expects args[0] to be a string (got ${JSON.stringify(args[0])})`);
    }
    return backend.str2et(args[0]);
  },

  // Convenience alias.
  str2et: (backend, args) => {
    if (typeof args[0] !== "string") {
      throw new TypeError(`str2et expects args[0] to be a string (got ${JSON.stringify(args[0])})`);
    }
    return backend.str2et(args[0]);
  },
};

function safeErrorReport(error: unknown): RunnerErrorReport {
  if (error instanceof Error) {
    const report: RunnerErrorReport = { message: error.message };
    if (error.name) report.name = error.name;
    if (error.stack) report.stack = error.stack;
    return report;
  }

  return { message: String(error) };
}

function tryConfigureErrorPolicy(backend: SpiceBackend): void {
  // Not part of the backend contract, but may exist on some implementations.
  const b = backend as unknown as {
    erract?: (op: string, action: string) => void;
    errprt?: (op: string, list: string) => void;
  };

  try {
    b.erract?.("SET", "RETURN");
  } catch {
    // ignore
  }

  try {
    b.errprt?.("SET", "NONE");
  } catch {
    // ignore
  }
}

function isolateCase(backend: SpiceBackend): void {
  // Clear any kernel pool / loaded kernels and reset the SPICE error state.
  backend.kclear();
  backend.reset();
  tryConfigureErrorPolicy(backend);
}

function captureSpiceErrorState(backend: SpiceBackend): SpiceErrorState {
  let failed = false;
  try {
    failed = backend.failed();
  } catch {
    failed = false;
  }

  if (!failed) return { failed: false };

  const spice: SpiceErrorState = { failed: true };

  try {
    spice.short = backend.getmsg("SHORT");
  } catch {
    // ignore
  }

  try {
    spice.long = backend.getmsg("LONG");
  } catch {
    // ignore
  }

  try {
    spice.explain = backend.getmsg("EXPLAIN");
  } catch {
    // ignore
  }

  return spice;
}

export async function createTspiceRunner(): Promise<CaseRunner> {
  const backend = await createBackend({ backend: "node" });

  return {
    kind: "tspice(node)",

    async runCase(input: RunCaseInput): Promise<RunCaseResult> {
      isolateCase(backend);

      try {
        for (const kernel of input.setup?.kernels ?? []) {
          backend.furnsh(kernel);
        }

        const fn = DISPATCH[input.call];
        if (!fn) {
          throw new Error(`Unsupported call: ${JSON.stringify(input.call)}`);
        }

        const result = fn(backend, input.args);
        return { ok: true, result };
      } catch (error) {
        const report = safeErrorReport(error);

        // Try to capture SPICE internal error messages for debugging.
        report.spice = captureSpiceErrorState(backend);

        // Ensure subsequent cases start clean.
        try {
          backend.reset();
        } catch {
          // ignore
        }

        return { ok: false, error: report };
      } finally {
        // Per-case isolation: don't allow kernels or error state to leak.
        try {
          backend.kclear();
        } catch {
          // ignore
        }
        try {
          backend.reset();
        } catch {
          // ignore
        }
      }
    },
  };
}
