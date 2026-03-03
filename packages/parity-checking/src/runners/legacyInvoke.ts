import type { RunCaseInput } from "./types.js";

type V3RunCaseInput = Extract<RunCaseInput, { schemaVersion: 3 }>;

export type LegacyInvokeValidation = {
  invalidRequest(message: string): never;
  invalidArgs(message: string): never;
};

export type LoweredLegacyInvokeInput = {
  call: string;
  args: unknown[];
};

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (value === Infinity) return "Infinity";
    if (value === -Infinity) return "-Infinity";
    return String(value);
  }

  try {
    const s = JSON.stringify(value);
    return s === undefined ? String(value) : s;
  } catch {
    return String(value);
  }
}

/**
 * Lower a schema-v3 single-step callContract case into legacy call+args input.
 *
 * Returns null when the workflow is not a single callContract step.
 */
export function lowerV3CallContract(
  input: V3RunCaseInput,
  validation: LegacyInvokeValidation,
): LoweredLegacyInvokeInput | null {
  if (input.workflow.steps.length !== 1) {
    return null;
  }

  const [step] = input.workflow.steps as Array<{ op?: string; call?: string }>;
  if (step?.op !== "callContract") {
    return null;
  }

  if ((input.workflow.cleanup?.length ?? 0) > 0) {
    validation.invalidRequest("v3 callContract workflow must not define cleanup steps");
  }

  const call = step.call ?? input.contract.contractMethod;
  if (typeof call !== "string" || call.trim() === "") {
    validation.invalidRequest("v3 callContract requires a non-empty call name");
  }

  const args = input.args ?? [];
  if (!Array.isArray(args)) {
    validation.invalidArgs(`v3 callContract expects case args to be an array (got ${formatValue(args)})`);
  }

  return {
    call,
    args,
  };
}

// Backward-compatible export name for tests/modules that still import old symbol.
export const lowerV2InvokeLegacyCall = lowerV3CallContract;
