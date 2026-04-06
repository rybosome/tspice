import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { spiceClients } from "@rybosome/tspice";

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
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function repoRoot(): string {
  return path.resolve(packageRoot(), "..", "..");
}

function fixtureRoot(): string {
  return path.join(repoRoot(), "packages", "tspice", "test", "fixtures", "kernels");
}

function exeExt(): string {
  return process.platform === "win32" ? ".exe" : "";
}

/** Get the expected on-disk path to the CSPICE runner binary (if built). */
export function getCspiceRunnerBinaryPath(): string {
  return path.join(packageRoot(), "native", "build", `cspice-runner${exeExt()}`);
}

/** Get the expected on-disk path to the CSPICE runner build state JSON. */
export function getCspiceRunnerBuildStatePath(): string {
  return path.join(packageRoot(), "native", "build", "cspice-runner.state.json");
}

/** Read the CSPICE runner build state (if present), otherwise return null. */
export function readCspiceRunnerBuildState(): CspiceRunnerBuildState | null {
  const buildStatePath = getCspiceRunnerBuildStatePath();
  try {
    const raw = fs.readFileSync(buildStatePath, "utf8");
    return JSON.parse(raw) as CspiceRunnerBuildState;
  } catch {
    return null;
  }
}

/**
 * Canonical generated-dispatch mode does not depend on a native runner binary.
 */
export function isCspiceRunnerAvailable(): boolean {
  return true;
}

/**
 * Get runner readiness + an informational hint for generated-dispatch mode.
 */
export function getCspiceRunnerStatus(): { ready: boolean; hint: string; statePath: string } {
  const statePath = getCspiceRunnerBuildStatePath();
  return {
    ready: true,
    hint: "generated dispatch seam mode (native binary optional in this phase)",
    statePath,
  };
}

async function createRuntimeContext(): Promise<{
  runtime: GeneratedDispatchRuntimeContext;
  dispose: () => Promise<void>;
}> {
  const client = await spiceClients.toSync({ backend: "node" });

  return {
    runtime: {
      raw: client.spice.raw,
      kit: client.spice.kit,
      backendKind: client.spice.raw.kind,
      repoRoot: repoRoot(),
      fixtureRoot: fixtureRoot(),
    },
    dispose: async () => {
      await client.dispose();
    },
  };
}

/** Create a CaseRunner that executes canonical call steps on cspice lane intent. */
export async function createCspiceRunner(): Promise<CaseRunner> {
  const runtimeContext = await createRuntimeContext();

  return {
    kind: "cspice(raw)",

    async dispose(): Promise<void> {
      await runtimeContext.dispose();
    },

    async runCase(input: RunCaseInput): Promise<RunCaseResult> {
      try {
        const result = executeCanonicalWorkflowCaseWithExplicitRuntime(
          "cspice",
          input,
          runtimeContext.runtime,
        );
        return { ok: true, result };
      } catch (error) {
        const report = asRunnerError(error);
        report.spice = { failed: false };
        return { ok: false, error: report };
      }
    },
  };
}
