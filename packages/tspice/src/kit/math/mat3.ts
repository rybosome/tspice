import type { Mat3ColMajor, Mat3RowMajor } from "@rybosome/tspice-backend-contract";
import { brandMat3ColMajor, brandMat3RowMajor } from "@rybosome/tspice-backend-contract";

function cloneRowMajor(m: Readonly<Mat3RowMajor>): Mat3RowMajor {
  // Ensure we don't retain a mutable caller-provided array reference.
  return brandMat3RowMajor([m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]] as const, {
    label: "Mat3.cloneRowMajor",
  });
}

function cloneColMajor(m: Readonly<Mat3ColMajor>): Mat3ColMajor {
  // Ensure we don't retain a mutable caller-provided array reference.
  return brandMat3ColMajor([m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]] as const, {
    label: "Mat3.cloneColMajor",
  });
}

function rowMajorToColMajor(m: Readonly<Mat3RowMajor>): Mat3ColMajor {
  // [m00,m01,m02, m10,m11,m12, m20,m21,m22] -> [m00,m10,m20, m01,m11,m21, m02,m12,m22]
  return brandMat3ColMajor([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]] as const, {
    label: "Mat3.rowMajorToColMajor",
  });
}

function colMajorToRowMajor(m: Readonly<Mat3ColMajor>): Mat3RowMajor {
  // [m00,m10,m20, m01,m11,m21, m02,m12,m22] -> [m00,m01,m02, m10,m11,m12, m20,m21,m22]
  return brandMat3RowMajor([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]] as const, {
    label: "Mat3.colMajorToRowMajor",
  });
}

/**
 * 3x3 matrix wrapper that exposes both row-major and column-major layouts.
 *
 * The underlying math value is the same; only the memory layout differs.
 *
 * Implementation notes:
 * - We store a single canonical (row-major) layout.
 * - The column-major layout is derived lazily and cached.
 * - Returned layout arrays are frozen in dev builds to help catch invariant-breaking mutation.
 */
export class Mat3 {
  readonly #rowMajor: Readonly<Mat3RowMajor>;
  #colMajor: Readonly<Mat3ColMajor> | undefined;

  /** Create a Mat3 from cached row/col-major representations. Prefer the static constructors. */
  private constructor(rowMajor: Readonly<Mat3RowMajor>, colMajor?: Readonly<Mat3ColMajor>) {
    this.#rowMajor = rowMajor;
    this.#colMajor = colMajor;
  }

  /** Create a {@link Mat3} from a row-major 3x3 array (input is cloned). */
  static fromRowMajor(m: Readonly<Mat3RowMajor>): Mat3 {
    return new Mat3(cloneRowMajor(m));
  }

  /** Create a {@link Mat3} from a column-major 3x3 array (input is cloned). */
  static fromColMajor(m: Readonly<Mat3ColMajor>): Mat3 {
    const colMajor = cloneColMajor(m);
    const rowMajor = colMajorToRowMajor(colMajor);
    return new Mat3(rowMajor, colMajor);
  }

  /** Create an identity 3x3 matrix. */
  static identity(): Mat3 {
    return Mat3.fromRowMajor(
      brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, 1] as const, {
        label: "Mat3.identity",
      }),
    );
  }

  /** Row-major representation (as a cached branded tuple). */
  get rowMajor(): Readonly<Mat3RowMajor> {
    return this.#rowMajor;
  }

  /** Column-major representation (computed lazily and cached). */
  get colMajor(): Readonly<Mat3ColMajor> {
    let colMajor = this.#colMajor;
    if (!colMajor) {
      colMajor = rowMajorToColMajor(this.#rowMajor);
      this.#colMajor = colMajor;
    }
    return colMajor;
  }

  /** Alias for {@link rowMajor}. */
  toRowMajor(): Readonly<Mat3RowMajor> {
    return this.rowMajor;
  }

  /** Alias for {@link colMajor}. */
  toColMajor(): Readonly<Mat3ColMajor> {
    return this.colMajor;
  }
}
