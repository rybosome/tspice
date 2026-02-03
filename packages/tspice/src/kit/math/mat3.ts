import type {
  Mat3ColMajor,
  Mat3RowMajor,
} from "@rybosome/tspice-backend-contract";

function rowMajorToColMajor(m: Mat3RowMajor): Mat3ColMajor {
  // [m00,m01,m02, m10,m11,m12, m20,m21,m22] -> [m00,m10,m20, m01,m11,m21, m02,m12,m22]
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]] as Mat3ColMajor;
}

function colMajorToRowMajor(m: Mat3ColMajor): Mat3RowMajor {
  // [m00,m10,m20, m01,m11,m21, m02,m12,m22] -> [m00,m01,m02, m10,m11,m12, m20,m21,m22]
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]] as Mat3RowMajor;
}

/**
 * 3x3 matrix wrapper that exposes both row-major and column-major layouts.
 *
 * The underlying math value is the same; only the memory layout differs.
 */
export class Mat3 {
  readonly rowMajor: Mat3RowMajor;
  readonly colMajor: Mat3ColMajor;

  private constructor(rowMajor: Mat3RowMajor, colMajor: Mat3ColMajor) {
    this.rowMajor = rowMajor;
    this.colMajor = colMajor;
  }

  static fromRowMajor(m: Mat3RowMajor): Mat3 {
    return new Mat3(m, rowMajorToColMajor(m));
  }

  static fromColMajor(m: Mat3ColMajor): Mat3 {
    return new Mat3(colMajorToRowMajor(m), m);
  }

  static identity(): Mat3 {
    return Mat3.fromRowMajor([1, 0, 0, 0, 1, 0, 0, 0, 1] as Mat3RowMajor);
  }

  toRowMajor(): Mat3RowMajor {
    return this.rowMajor;
  }

  toColMajor(): Mat3ColMajor {
    return this.colMajor;
  }
}
