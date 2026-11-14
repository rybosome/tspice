import { assertSpiceInt32 } from "../shared/spice-int.js";

/** Double elements in the 256 MiB per-buffer budget shared by the general-matrix adapters. */
const MAX_MATRIX_ELEMENTS = 33_554_432;

/** Validate a dimension against the signed SPICE ABI and its routine-specific sign policy. */
export function matrixDimension(
  value: number,
  label: string,
  allowNegative = false,
): void {
  assertSpiceInt32(value, label, allowNegative ? undefined : { min: 0 });
}

/** Guard each operand, result, private CSPICE temporary, and signed two-dimensional index. */
export function matrixElementCount(rows: number, cols: number): number {
  const count = rows * cols;
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_MATRIX_ELEMENTS)
    throw new RangeError("Matrix buffer exceeds 256 MiB");
  return count;
}

/** Matrix-matrix multiplication still visits every output row when the output width is zero. */
export function checkMatrixProductRows(rows: number): void {
  if (rows > MAX_MATRIX_ELEMENTS)
    throw new RangeError(
      "Matrix output row count exceeds the supported loop bound",
    );
}

/** Check every shape before traversing any possibly sparse or accessor-backed operand. */
export function checkMatrixInputLength(
  value: readonly number[],
  count: number,
  label: string,
): void {
  if (!Array.isArray(value) || value.length !== count)
    throw new TypeError(`${label} must be a flat array of length ${count}`);
}
