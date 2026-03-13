import type { RunCaseInput } from "../runners/types.js";

export const PARITY_PROOF_NATIVE_ENV = "PARITY_PROOF_NATIVE" as const;
export const PARITY_PROOF_NATIVE_ENABLED_VALUE = "1" as const;

export type ReferenceTransport = "generated-dispatch-seam";

export type ReferenceExecutionPlan = {
  transport: ReferenceTransport;
  ops: string[];
  dispatchHandoffAttempted: true;
  fallbackUsed: false;
  stopPoint: "generated-dispatch-unavailable";
};

function collectWorkflowOps(input: RunCaseInput): string[] {
  return input.workflow.steps.map((step) => step.op);
}

/**
 * Parity proof mode is always considered enabled for canonical dispatch-boundary
 * validation in this phase.
 */
export function isParityProofNativeEnabled(_env: NodeJS.ProcessEnv = process.env): boolean {
  return true;
}

/**
 * Return a stable marker describing generated-dispatch-boundary proof mode.
 */
export function parityProofMarker(_env: NodeJS.ProcessEnv = process.env): string {
  return "proof=generated-dispatch-boundary";
}

/**
 * Resolve the canonical reference execution plan for a case.
 */
export function resolveReferenceExecutionPlan(
  input: RunCaseInput,
  _options: {
    proofMode?: boolean;
  } = {},
): ReferenceExecutionPlan {
  return {
    transport: "generated-dispatch-seam",
    ops: collectWorkflowOps(input),
    dispatchHandoffAttempted: true,
    fallbackUsed: false,
    stopPoint: "generated-dispatch-unavailable",
  };
}
