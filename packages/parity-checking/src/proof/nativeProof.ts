import type { RunCaseInput } from "../runners/types.js";

export const PARITY_PROOF_NATIVE_V2_ENV = "PARITY_PROOF_NATIVE_V2" as const;
export const PARITY_PROOF_NATIVE_V2_ENABLED_VALUE = "1" as const;

export type ReferenceTransport = "native-cspice-runner";

export type ReferenceExecutionPlan = {
  transport: ReferenceTransport;
  ops: string[];
};

function collectWorkflowOps(input: RunCaseInput): string[] {
  const stepOps = input.workflow.steps.map((step) => step.op);
  const cleanupOps = (input.workflow.cleanup ?? []).map((step) => step.op);
  return [...stepOps, ...cleanupOps];
}

/**
 * Return true when native proof v2 mode is enabled via process env.
 */
export function isParityProofNativeV2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[PARITY_PROOF_NATIVE_V2_ENV] === PARITY_PROOF_NATIVE_V2_ENABLED_VALUE;
}

/**
 * Return a stable marker describing the current native proof mode.
 */
export function parityProofMarker(env: NodeJS.ProcessEnv = process.env): string {
  return isParityProofNativeV2Enabled(env) ? "proof=native-v2" : "proof=disabled";
}

/**
 * Resolve the reference execution transport for a case.
 *
 * CSPICE lane is native-only and never substitutes a callContract fast-path.
 */
export function resolveReferenceExecutionPlan(
  input: RunCaseInput,
  _options: {
    proofMode?: boolean;
  } = {},
): ReferenceExecutionPlan {
  return {
    transport: "native-cspice-runner",
    ops: collectWorkflowOps(input),
  };
}
