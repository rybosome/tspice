import type { RunCaseInput } from "../runners/types.js";

export const PARITY_PROOF_NATIVE_V2_ENV = "PARITY_PROOF_NATIVE_V2" as const;
export const PARITY_PROOF_NATIVE_V2_ENABLED_VALUE = "1" as const;

export const PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST = ["dskb02_c", "dskgd_c"] as const;

export type NativeProofExceptionMethod = (typeof PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST)[number];

export type ReferenceTransport = "native-cspice-runner" | "callContract-fast-path";

export type ReferenceExecutionPlan = {
  transport: ReferenceTransport;
  excepted: boolean;
  exceptionMethod?: NativeProofExceptionMethod;
  ops: string[];
};

function isSingleCallContractWorkflow(input: RunCaseInput): boolean {
  return input.workflow.steps.length === 1 && input.workflow.steps[0]?.op === "callContract";
}

function resolveCallContractMethod(input: RunCaseInput): string | undefined {
  if (!isSingleCallContractWorkflow(input)) {
    return undefined;
  }

  const step = input.workflow.steps[0];
  if (!step || step.op !== "callContract") {
    return undefined;
  }

  const workflowCall = step.call;
  if (typeof workflowCall === "string" && workflowCall.trim().length > 0) {
    return workflowCall.trim();
  }

  const contractMethod = input.contract.contractMethod;
  if (typeof contractMethod === "string" && contractMethod.trim().length > 0) {
    return contractMethod.trim();
  }

  return undefined;
}

function collectWorkflowOps(input: RunCaseInput): string[] {
  const stepOps = input.workflow.steps.map((step) => step.op);
  const cleanupOps = (input.workflow.cleanup ?? []).map((step) => step.op);
  return [...stepOps, ...cleanupOps];
}

const PROOF_EXCEPTION_ALLOWLIST = new Set<string>(PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST);

function isProofExceptionMethod(method: string | undefined): method is NativeProofExceptionMethod {
  return typeof method === "string" && PROOF_EXCEPTION_ALLOWLIST.has(method);
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
 * Resolve the reference execution transport and exception metadata for a case.
 */
export function resolveReferenceExecutionPlan(
  input: RunCaseInput,
  options: {
    proofMode?: boolean;
  } = {},
): ReferenceExecutionPlan {
  const proofMode = options.proofMode ?? isParityProofNativeV2Enabled();
  const ops = collectWorkflowOps(input);

  if (!isSingleCallContractWorkflow(input)) {
    return {
      transport: "native-cspice-runner",
      excepted: false,
      ops,
    };
  }

  const method = resolveCallContractMethod(input);
  const excepted = isProofExceptionMethod(method);

  if (proofMode && !excepted) {
    return {
      transport: "native-cspice-runner",
      excepted,
      ops,
    };
  }

  return {
    transport: "callContract-fast-path",
    excepted,
    ...(excepted && method ? { exceptionMethod: method } : {}),
    ops,
  };
}
