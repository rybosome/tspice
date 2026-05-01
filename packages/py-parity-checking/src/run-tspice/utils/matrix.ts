import type { Mat3RowMajor } from "@rybosome/tspice-backend-contract";

import type { Matrix3x3 } from "../../case-types.js";

type MatrixValues9 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

function requiredNumber(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`Matrix output missing value at index ${index}`);
  }

  return value;
}

function toMatrixValues(matrix: Matrix3x3): MatrixValues9 {
  return [
    matrix[0][0],
    matrix[0][1],
    matrix[0][2],
    matrix[1][0],
    matrix[1][1],
    matrix[1][2],
    matrix[2][0],
    matrix[2][1],
    matrix[2][2],
  ];
}

/** Convert nested matrix rows to the row-major shape expected by `spice.raw.mxm`. */
export function flattenMatrix(matrix: Matrix3x3): Mat3RowMajor {
  return toMatrixValues(matrix) as Mat3RowMajor;
}

/** Convert a row-major matrix output into the nested matrix shape used by parity cases. */
export function unflattenMatrix(values: readonly number[]): Matrix3x3 {
  if (values.length !== 9) {
    throw new Error(`Expected 9 matrix values, got ${values.length}`);
  }

  const a = requiredNumber(values, 0);
  const b = requiredNumber(values, 1);
  const c = requiredNumber(values, 2);
  const d = requiredNumber(values, 3);
  const e = requiredNumber(values, 4);
  const f = requiredNumber(values, 5);
  const g = requiredNumber(values, 6);
  const h = requiredNumber(values, 7);
  const i = requiredNumber(values, 8);

  return [
    [a, b, c],
    [d, e, f],
    [g, h, i],
  ];
}
