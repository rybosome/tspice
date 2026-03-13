import type { RunCaseInput } from "../runners/types.js";

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
 * Parity proof mode is unconditionally enabled in canonical
 * dispatch-boundary validation.
 */
export function isParityProofNativeEnabled(): boolean {
  return true;
}

/**
 * Return a stable marker describing generated-dispatch-boundary proof mode.
 */
export function parityProofMarker(): string {
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
