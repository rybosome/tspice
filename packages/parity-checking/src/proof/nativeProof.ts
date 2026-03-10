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
* Native proof v2 orchestration is always active.
*
* The legacy env gate is intentionally ignored so parity orchestration always
* compares both tspice lanes (`node`, `wasm`) against the native cspice lane.
*/
export function isParityProofNativeV2Enabled(_env: NodeJS.ProcessEnv = process.env): boolean {
  return true;
}

/**
* Return a stable marker describing the enforced orchestration mode.
*/
export function parityProofMarker(_env: NodeJS.ProcessEnv = process.env): string {
  return "proof=native-v2";
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
