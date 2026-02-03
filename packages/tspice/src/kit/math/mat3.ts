import type { Mat3ColMajor, Mat3RowMajor } from "@rybosome/tspice-backend-contract";

function cloneRowMajor(m: Readonly<Mat3RowMajor>): Mat3RowMajor {
  // Ensure we don't retain a mutable caller-provided array reference.
  return [m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]] as Mat3RowMajor;
}

function cloneColMajor(m: Readonly<Mat3ColMajor>): Mat3ColMajor {
  // Ensure we don't retain a mutable caller-provided array reference.
  return [m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]] as Mat3ColMajor;
}

function rowMajorToColMajor(m: Readonly<Mat3RowMajor>): Mat3ColMajor {
  // [m00,m01,m02, m10,m11,m12, m20,m21,m22] -> [m00,m10,m20, m01,m11,m21, m02,m12,m22]
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]] as Mat3ColMajor;
}

function colMajorToRowMajor(m: Readonly<Mat3ColMajor>): Mat3RowMajor {
  // [m00,m10,m20, m01,m11,m21, m02,m12,m22] -> [m00,m01,m02, m10,m11,m12, m20,m21,m22]
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]] as Mat3RowMajor;
}

/**
 * 3x3 matrix wrapper that exposes both row-major and column-major layouts.
 *
 * The underlying math value is the same; only the memory layout differs.
 *
 * Implementation notes:
 * - We store a single canonical (row-major) layout.
 * - The column-major layout is derived lazily and cached.
 * - Returned layout arrays are frozen to prevent invariant-breaking mutation.
 */
export class Mat3 {
  readonly #rowMajor: Readonly<Mat3RowMajor>;
  #colMajor: Readonly<Mat3ColMajor> | undefined;

  private constructor(rowMajor: Readonly<Mat3RowMajor>, colMajor?: Readonly<Mat3ColMajor>) {
    this.#rowMajor = rowMajor;
    this.#colMajor = colMajor;
  }

  static fromRowMajor(m: Readonly<Mat3RowMajor>): Mat3 {
    const rowMajor = Object.freeze(cloneRowMajor(m));
    return new Mat3(rowMajor);
  }

  static fromColMajor(m: Readonly<Mat3ColMajor>): Mat3 {
    const colMajor = Object.freeze(cloneColMajor(m));
    const rowMajor = Object.freeze(colMajorToRowMajor(colMajor));
    return new Mat3(rowMajor, colMajor);
  }

  static identity(): Mat3 {
    return Mat3.fromRowMajor([1, 0, 0, 0, 1, 0, 0, 0, 1] as Mat3RowMajor);
  }

  get rowMajor(): Readonly<Mat3RowMajor> {
    return this.#rowMajor;
  }

  get colMajor(): Readonly<Mat3ColMajor> {
    let colMajor = this.#colMajor;
    if (!colMajor) {
      colMajor = Object.freeze(rowMajorToColMajor(this.#rowMajor));
      this.#colMajor = colMajor;
    }
    return colMajor;
  }

  toRowMajor(): Readonly<Mat3RowMajor> {
    return this.rowMajor;
  }

  toColMajor(): Readonly<Mat3ColMajor> {
    return this.colMajor;
  }
}
