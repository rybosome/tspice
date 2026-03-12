import { lookupFunctionRegistryEntry } from "../generated/functionRegistry.js";

import type { RunCaseInput, RunCaseInputV3, V3WorkflowCallStep } from "../runners/types.js";

export const PARITY_PROOF_NATIVE_V2_ENV = "PARITY_PROOF_NATIVE_V2" as const;
export const PARITY_PROOF_NATIVE_V2_ENABLED_VALUE = "1" as const;

export const PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST = ["dskb02_c", "dskgd_c"] as const;

export type NativeProofExceptionMethod = (typeof PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST)[number];

export type ReferenceTransport = "native-cspice-runner";

export type ReferenceExecutionPlan = {
  transport: ReferenceTransport;
  excepted: boolean;
  exceptionMethod?: NativeProofExceptionMethod;
  ops: string[];
};

const PROOF_EXCEPTION_ALLOWLIST = new Set<string>(PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST);

function isRunCaseInputV3(input: RunCaseInput): input is RunCaseInputV3 {
  return typeof input === "object" && input !== null && "schemaVersion" in input;
}

function collectWorkflowOps(input: RunCaseInput): string[] {
  if (!isRunCaseInputV3(input) || input.schemaVersion !== 3) {
    return [];
  }

  const stepOps = input.workflow.steps.map((step) => step.op);
  const cleanupOps = (input.workflow.cleanup ?? []).map((step) => step.op);
  return [...stepOps, ...cleanupOps];
}

function resolveCallMethod(input: RunCaseInputV3): string | undefined {
  const firstCallStep = input.workflow.steps.find((step): step is V3WorkflowCallStep => step.op === "call");
  const explicitCall = firstCallStep?.fn;

  if (typeof explicitCall === "string" && explicitCall.trim().length > 0 && explicitCall.trim() !== "self") {
    return explicitCall.trim();
  }

  const contractMethod = input.contract.contractMethod;
  if (typeof contractMethod === "string" && contractMethod.trim().length > 0) {
    return contractMethod.trim();
  }

  return undefined;
}

function resolveMethodCSymbol(method: string | undefined): string | undefined {
  if (!method) {
    return undefined;
  }

  const entry = lookupFunctionRegistryEntry(method);
  return entry?.impl.cSymbol;
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
 * Resolve reference execution metadata for proof reporting.
 *
 * CSPICE reference execution is always native runner dispatch.
 */
export function resolveReferenceExecutionPlan(input: RunCaseInput): ReferenceExecutionPlan {
  const ops = collectWorkflowOps(input);

  if (!isRunCaseInputV3(input) || input.schemaVersion !== 3) {
    return {
      transport: "native-cspice-runner",
      excepted: false,
      ops,
    };
  }

  const cSymbol = resolveMethodCSymbol(resolveCallMethod(input));
  const excepted = typeof cSymbol === "string" && PROOF_EXCEPTION_ALLOWLIST.has(cSymbol);

  return {
    transport: "native-cspice-runner",
    excepted,
    ...(excepted && cSymbol ? { exceptionMethod: cSymbol as NativeProofExceptionMethod } : {}),
    ops,
  };
}
