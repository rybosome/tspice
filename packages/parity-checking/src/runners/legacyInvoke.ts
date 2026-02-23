import type { RunCaseInput } from "./types.js";

type V2RunCaseInput = Extract<RunCaseInput, { schemaVersion: 2 }>;

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
 * Lower a schema-v2 single-step invokeLegacyCall case into legacy call+args input.
 *
 * Returns null when the workflow is not a single invokeLegacyCall step.
 */
export function lowerV2InvokeLegacyCall(
  input: V2RunCaseInput,
  validation: LegacyInvokeValidation,
): LoweredLegacyInvokeInput | null {
  if (input.workflow.steps.length !== 1) {
    return null;
  }

  const [step] = input.workflow.steps;
  if (step?.op !== "invokeLegacyCall") {
    return null;
  }

  if ((input.workflow.cleanup?.length ?? 0) > 0) {
    validation.invalidRequest("v2 invokeLegacyCall workflow must not define cleanup steps");
  }

  const call = step.call ?? input.contract.contractMethod;
  if (typeof call !== "string" || call.trim() === "") {
    validation.invalidRequest("v2 invokeLegacyCall requires a non-empty call name");
  }

  const args = input.args ?? [];
  if (!Array.isArray(args)) {
    validation.invalidArgs(`v2 invokeLegacyCall expects case args to be an array (got ${formatValue(args)})`);
  }

  return {
    call,
    args,
  };
}
