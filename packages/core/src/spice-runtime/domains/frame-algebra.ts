import type { SpiceMatrix6x6 } from "../shared/types.js";

function numericStorage(value: unknown): value is ArrayLike<unknown> {
  return (
    Array.isArray(value) ||
    value instanceof Float64Array ||
    value instanceof Float32Array ||
    value instanceof Int8Array ||
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof Int16Array ||
    value instanceof Uint16Array ||
    value instanceof Int32Array ||
    value instanceof Uint32Array
  );
}

/** Snapshot the exact indexed values passed to a native or WASM frame routine. */
export function frameOperand(
  value: unknown,
  length: 3 | 6 | 9 | 36,
  label: string,
): number[] {
  if (!numericStorage(value) || value.length !== length)
    throw new TypeError(
      `${label} must contain exactly ${length} numeric values`,
    );
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const entry = value[i];
    if (typeof entry !== "number" || !Number.isFinite(entry))
      throw new RangeError(`${label}[${i}] must be a finite number`);
    out.push(entry);
  }
  return out;
}

function resultStorage(
  value: unknown,
  length: number,
  label: string,
): ArrayLike<unknown> {
  if (!numericStorage(value) || value.length !== length)
    throw new TypeError(
      `${label} must contain exactly ${length} numeric values`,
    );
  return value;
}
function component(
  values: ArrayLike<unknown>,
  i: number,
  label: string,
): number {
  const n = values[i];
  if (typeof n !== "number")
    throw new TypeError(`${label}[${i}] must be numeric`);
  return n;
}

/** Copy the 3 defined output components, preserving IEEE results from finite operands. */
export function frameVectorResult(
  value: unknown,
  label: string,
): [number, number, number] {
  const values = resultStorage(value, 3, label);
  return [
    component(values, 0, label),
    component(values, 1, label),
    component(values, 2, label),
  ];
}

/** Copy the 6 defined output components, preserving IEEE results from finite operands. */
export function frameStateResult(
  value: unknown,
  label: string,
): [number, number, number, number, number, number] {
  const values = resultStorage(value, 6, label);
  return [
    component(values, 0, label),
    component(values, 1, label),
    component(values, 2, label),
    component(values, 3, label),
    component(values, 4, label),
    component(values, 5, label),
  ];
}

/** Copy the 36 defined output components, preserving IEEE results from finite operands. */
export function frameMatrixResult(
  value: unknown,
  label: string,
): SpiceMatrix6x6 {
  const values = resultStorage(value, 36, label);
  function row(
    offset: number,
  ): [number, number, number, number, number, number] {
    return [
      component(values, offset, label),
      component(values, offset + 1, label),
      component(values, offset + 2, label),
      component(values, offset + 3, label),
      component(values, offset + 4, label),
      component(values, offset + 5, label),
    ];
  }
  return [...row(0), ...row(6), ...row(12), ...row(18), ...row(24), ...row(30)];
}
