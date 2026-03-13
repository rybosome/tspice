import {
  asRunnerError,
  executeCanonicalWorkflowCase,
} from "./workflowExecutor.js";

import type {
  CaseRunner,
  RunCaseInput,
  RunCaseResult,
} from "./types.js";

export type TspiceParityBackend = "auto" | "node" | "wasm";

export type CreateTspiceRunnerOptions = {
  backend?: TspiceParityBackend;
};

function parseBackendEnv(value: string | undefined): TspiceParityBackend | undefined {
  if (!value) return undefined;
  if (value === "auto" || value === "node" || value === "wasm") {
    return value;
  }
  throw new Error(`Invalid TSPICE_PARITY_BACKEND=${JSON.stringify(value)} (expected auto|node|wasm)`);
}

function resolveBackend(requested: TspiceParityBackend): {
  requested: TspiceParityBackend;
  actual: "node" | "wasm";
  fallbackDetected: boolean;
} {
  if (requested === "node") {
    return { requested, actual: "node", fallbackDetected: false };
  }

  if (requested === "wasm") {
    return { requested, actual: "wasm", fallbackDetected: false };
  }

  return { requested, actual: "node", fallbackDetected: false };
}

/**
 * Create a CaseRunner for tspice lane intent (node or wasm).
 *
 * In canonical generated-dispatch mode, execution fails closed at the dispatch
 * seam before any backend call is attempted.
 */
export async function createTspiceRunner(options: CreateTspiceRunnerOptions = {}): Promise<CaseRunner> {
  const requested =
    options.backend ?? parseBackendEnv(process.env.TSPICE_PARITY_BACKEND) ?? "auto";

  const { actual, fallbackDetected } = resolveBackend(requested);

  return {
    kind: `tspice(${actual})`,
    backendMetadata: {
      requestedBackend: requested,
      actualBackend: actual,
      fallbackDetected,
    },

    async runCase(input: RunCaseInput): Promise<RunCaseResult> {
      try {
        const result = executeCanonicalWorkflowCase(actual, input);
        return { ok: true, result };
      } catch (error) {
        const report = asRunnerError(error);
        report.spice = { failed: false };
        return { ok: false, error: report };
      }
    },
  };
}
