import {
  asRunnerError,
  executeCanonicalWorkflowCase,
} from "./workflowExecutor.js";
import {
  type DispatchBackend,
  createNodeLikeDispatchBackend,
  createWasmDispatchBackend,
} from "./backendDispatchFactory.js";

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

async function createDispatchBackend(actual: "node" | "wasm"): Promise<DispatchBackend> {
  if (actual === "node") {
    return createNodeLikeDispatchBackend();
  }

  return createWasmDispatchBackend();
}

/**
 * Create a CaseRunner for tspice lane intent (node or wasm).
 */
export async function createTspiceRunner(options: CreateTspiceRunnerOptions = {}): Promise<CaseRunner> {
  const requested =
    options.backend ?? parseBackendEnv(process.env.TSPICE_PARITY_BACKEND) ?? "auto";

  const { actual, fallbackDetected } = resolveBackend(requested);
  const backend = await createDispatchBackend(actual);

  return {
    kind: `tspice(${actual})`,
    backendMetadata: {
      requestedBackend: requested,
      actualBackend: actual,
      fallbackDetected,
    },

    async runCase(input: RunCaseInput): Promise<RunCaseResult> {
      try {
        const result = executeCanonicalWorkflowCase(actual, input, {
          rawBackend: backend.raw as unknown as Record<string, unknown>,
        });
        return { ok: true, result };
      } catch (error) {
        const report = asRunnerError(error);
        report.spice = { failed: false };
        return { ok: false, error: report };
      }
    },

    dispose(): void {
      // No explicit disposal contract on backend instances yet.
    },
  };
}
