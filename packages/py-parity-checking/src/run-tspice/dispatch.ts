import type { JsonValue, StepOutput, WorkflowStep } from "../case-types.js";
import type { RunTspiceContext } from "./context.js";

function normalizeValue(value: unknown): JsonValue {
  if (value === undefined || value === null) {
    return null;
  }

  const primitiveType = typeof value;
  if (primitiveType === "string" || primitiveType === "number" || primitiveType === "boolean") {
    return value as string | number | boolean;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) {
      return Array.from(
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
        (item) => normalizeValue(item),
      );
    }

    return Array.from(value as unknown as ArrayLike<unknown>, (item) => normalizeValue(item));
  }

  if (primitiveType === "object") {
    const out: Record<string, JsonValue> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalizeValue(nested);
    }
    return out;
  }

  throw new Error(`Unsupported output value type for parity normalization: ${String(value)}`);
}

function methodNameFromOp(op: WorkflowStep["op"]): string {
  const dot = op.lastIndexOf(".");
  if (dot <= 0 || dot >= op.length - 1) {
    throw new Error(`Invalid canonical op key: ${op}`);
  }
  return op.slice(dot + 1);
}

/** Execute one canonical raw-method workflow step in tspice. */
export function dispatchStep(context: RunTspiceContext, step: WorkflowStep): StepOutput {
  const methodName = methodNameFromOp(step.op);
  const fn = (context.spice.raw as unknown as Record<string, (...args: unknown[]) => unknown>)[methodName];
  if (typeof fn !== "function") {
    throw new Error(`tspice.raw is missing method for op ${step.op} (method ${methodName})`);
  }

  const value = fn(...(step.args ?? []));
  return {
    op: step.op,
    value: normalizeValue(value),
  };
}
