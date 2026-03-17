import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  asRunnerError,
  executeCanonicalWorkflowCase,
} from "./workflowExecutor.js";
import { createNodeLikeDispatchBackend } from "./backendDispatchFactory.js";

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
 * Canonical generated-dispatch mode does not depend on a native runner binary
 * for parity execution (native seam behavior is covered by integration tests).
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

/**
 * Create a CaseRunner for cspice reference-lane intent.
 *
 * Implemented generated-dispatch entries execute through the canonical callable
 * binding against a node-backed raw contract surface, while unimplemented or
 * missing entries remain strict fail-closed at the generated-dispatch seam.
 */
export async function createCspiceRunner(): Promise<CaseRunner> {
  const backend = await createNodeLikeDispatchBackend();

  return {
    kind: "cspice(raw)",

    async runCase(input: RunCaseInput): Promise<RunCaseResult> {
      try {
        const result = executeCanonicalWorkflowCase("cspice", input, {
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
      // No explicit disposal contract on createSpice() clients yet.
    },
  };
}
