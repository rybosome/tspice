import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  spiceClients,
} from "@rybosome/tspice";

import {
  asRunnerError,
  executeCanonicalWorkflowCaseWithExplicitRuntime,
} from "./workflowExecutor.js";

import type { GeneratedDispatchRuntimeContext } from "./generatedDispatchSeam.js";
import type {
  CaseRunner,
  RunCaseInput,
  RunCaseResult,
} from "./types.js";

export type TspiceParityBackend = "auto" | "node" | "wasm";

export type CreateTspiceRunnerOptions = {
  backend?: TspiceParityBackend;
};

type RuntimeBundle = {
  runtime: GeneratedDispatchRuntimeContext;
  dispose: () => Promise<void>;
};

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function repoRoot(): string {
  return path.resolve(packageRoot(), "..", "..");
}

function fixtureRoot(): string {
  return path.join(repoRoot(), "packages", "tspice", "test", "fixtures", "kernels");
}

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

async function createRuntimeBundle(backend: "node" | "wasm"): Promise<RuntimeBundle> {
  const client = await spiceClients.toSync({ backend });
  const actualKind = client.spice.raw.kind;

  if (actualKind !== backend) {
    await client.dispose();
    throw new Error(
      `tspice runner backend mismatch: requested=${backend}, actual=${actualKind}`,
    );
  }

  return {
    runtime: {
      raw: client.spice.raw,
      kit: client.spice.kit,
      backendKind: actualKind,
      repoRoot: repoRoot(),
      fixtureRoot: fixtureRoot(),
    },
    dispose: async () => {
      await client.dispose();
    },
  };
}

/**
 * Create a CaseRunner for tspice lane intent (node or wasm).
 */
export async function createTspiceRunner(options: CreateTspiceRunnerOptions = {}): Promise<CaseRunner> {
  const requested =
    options.backend ?? parseBackendEnv(process.env.TSPICE_PARITY_BACKEND) ?? "auto";

  const { actual, fallbackDetected } = resolveBackend(requested);
  const runtimeBundle = await createRuntimeBundle(actual);

  return {
    kind: `tspice(${actual})`,
    backendMetadata: {
      requestedBackend: requested,
      actualBackend: actual,
      fallbackDetected,
    },

    async dispose(): Promise<void> {
      await runtimeBundle.dispose();
    },

    async runCase(input: RunCaseInput): Promise<RunCaseResult> {
      try {
        const result = executeCanonicalWorkflowCaseWithExplicitRuntime(actual, input, runtimeBundle.runtime);
        return { ok: true, result };
      } catch (error) {
        const report = asRunnerError(error);
        report.spice = { failed: false };
        return { ok: false, error: report };
      }
    },
  };
}
