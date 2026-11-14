/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type { Mat3RowMajor, SpiceVector3 } from "../shared/types.js";

/** Backend contract for basic coordinate transforms and vector/matrix math. */
export interface CoordsVectorsApi {
  /**
   * Return the determinant of a finite 3x3 matrix in row-major order.
   *
   * CSPICE evaluates the determinant directly. Overflow, underflow and
   * cancellation retain its floating-point behavior, including nonfinite
   * results. The input is unchanged. No kernels are needed. CSPICE is
   * error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/det_c.html
   */
  det(m: Mat3RowMajor): number;

  /**
   * Diagonalize a symmetric 2x2 matrix, returning independent diag and rotate matrices.
   *
   * Input and outputs use flat row-major order [m00, m01, m10, m11]. All input
   * entries must be finite. CSPICE uses only m00, m01 and m11; m10 is ignored,
   * so differing off-diagonal entries are accepted without symmetrization.
   * For the symmetric matrix represented by those upper-triangular entries,
   * diag = transpose(rotate) * symmat * rotate. The columns of rotate are
   * eigenvectors; CSPICE chooses a rotation of smallest absolute angle.
   * Eigenvalues are not sorted and signs are not canonicalized; tied choices
   * retain CSPICE's selection. A diagonal input retains its diagonal order
   * and gives identity rotate. Zero or negative eigenvalues are allowed.
   * Numerical limits, including nonfinite results, remain those of CSPICE.
   * No kernels are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/diags2_c.html
   */
  diags2(symmat: readonly [number, number, number, number]): {
    diag: [number, number, number, number];
    rotate: [number, number, number, number];
  };

  /**
   * Return an independent 3x3 identity matrix in row-major order.
   *
   * No kernels are needed. This calls CSPICE's error-free ident_c routine.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ident_c.html
   */
  ident(): Mat3RowMajor;

  /**
   * Return the inverse of a finite 3x3 row-major matrix as an independent matrix.
   *
   * Pinned CSPICE N0067 returns an all-zero matrix when abs(det(m)) < 1e-16;
   * this is a strict threshold, not a SPICE error. Otherwise it evaluates
   * cofactors and divides by the determinant. Inputs should keep these
   * intermediate products within floating-point range. Overflow, underflow
   * and cancellation are not corrected, and nonfinite outputs are retained.
   * No kernels are needed. Invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/invert_c.html
   */
  invert(m: Mat3RowMajor): Mat3RowMajor;

  /**
   * Transpose a finite 3x3 matrix and divide each output row by its squared norm.
   *
   * The result is an inverse when the input columns are orthogonal and
   * nonzero; CSPICE does not validate orthogonality. Inputs and the independent
   * output use row-major order. A zero-length column throws
   * SPICE(ZEROLENGTHCOLUMN); a column whose norm is too small to reciprocate
   * throws SPICE(COLUMNTOOSMALL). Other numerical limits retain CSPICE behavior.
   * No kernels are needed. Invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/invort_c.html
   */
  invort(m: Mat3RowMajor): Mat3RowMajor;

  /**
   * Test a finite 3x3 row-major matrix using CSPICE's rotation criteria.
   *
   * Column norms must be in [1 - ntol, 1 + ntol]. The determinant of the
   * matrix with unitized columns must be in [1 - dtol, 1 + dtol]. Bounds
   * are inclusive; this is a tolerance test, not an exact orthogonality test.
   * Both tolerances must be finite. Negative tolerances reach CSPICE and
   * throw SPICE(VALUEOUTOFRANGE); zero tolerances are allowed. No kernels
   * are needed. Invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/isrot_c.html
   */
  isrot(m: Mat3RowMajor, ntol: number, dtol: number): boolean;

  /**
   * Return an independent row-major copy of a finite 3x3 matrix.
   *
   * Component order and signed zeros are retained. No kernels are needed.
   * CSPICE is error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mequ_c.html
   */
  mequ(m: Mat3RowMajor): Mat3RowMajor;

  /**
   * Return transpose(a) * b as an independent 3x3 row-major matrix.
   *
   * Both input matrices contain exactly nine finite numbers in row-major
   * order and are unchanged. Keep intermediate products within range for
   * meaningful results; CSPICE overflow, underflow and cancellation are
   * preserved, including nonfinite outputs. No kernels are needed. CSPICE
   * is error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mtxm_c.html
   */
  mtxm(a: Mat3RowMajor, b: Mat3RowMajor): Mat3RowMajor;

  /**
   * Return a * transpose(b) as an independent 3x3 row-major matrix.
   *
   * Both input matrices contain exactly nine finite numbers in row-major
   * order and are unchanged. Keep intermediate products within range for
   * meaningful results; CSPICE overflow, underflow and cancellation are
   * preserved, including nonfinite outputs. No kernels are needed. CSPICE
   * is error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mxmt_c.html
   */
  mxmt(a: Mat3RowMajor, b: Mat3RowMajor): Mat3RowMajor;

  /**
   * Return the sum of the diagonal entries of a finite 3x3 row-major matrix.
   *
   * The input is unchanged. Summation retains CSPICE floating-point behavior,
   * including overflow and cancellation. No kernels are needed. CSPICE is
   * error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/trace_c.html
   */
  trace(m: Mat3RowMajor): number;

  /**
   * Return the transpose of a finite 3x3 matrix as an independent row-major matrix.
   *
   * The input is unchanged and every component, including signed zero, is
   * retained in transposed position. No kernels are needed. CSPICE is
   * error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/xpose_c.html
   */
  xpose(m: Mat3RowMajor): Mat3RowMajor;

  /** SPICE `reclat_c`: rectangular -> latitudinal coordinates. */
  reclat(rect: SpiceVector3): { radius: number; lon: number; lat: number };
  /** SPICE `latrec_c`: latitudinal -> rectangular coordinates. */
  latrec(radius: number, lon: number, lat: number): SpiceVector3;

  /** SPICE `recsph_c`: rectangular -> spherical coordinates. */
  recsph(rect: SpiceVector3): { radius: number; colat: number; lon: number };
  /** SPICE `sphrec_c`: spherical -> rectangular coordinates. */
  sphrec(radius: number, colat: number, lon: number): SpiceVector3;

  /** SPICE `vnorm_c`: vector magnitude (Euclidean norm). */
  vnorm(v: SpiceVector3): number;

  /**
   * Compute the unit vector of `v`.
   *
   * **Zero-vector behavior:** if `v` is `[0, 0, 0]`, this returns `[0, 0, 0]` and
   * does **not** throw.
   *
   * This matches the NAIF CSPICE `vhat_c` definition.
   */
  vhat(v: SpiceVector3): SpiceVector3;
  /** SPICE `vdot_c`: dot product of two vectors. */
  vdot(a: SpiceVector3, b: SpiceVector3): number;
  /** SPICE `vcrss_c`: cross product of two vectors. */
  vcrss(a: SpiceVector3, b: SpiceVector3): SpiceVector3;

  /** SPICE `vadd_c`: vector addition. */
  vadd(a: SpiceVector3, b: SpiceVector3): SpiceVector3;
  /** SPICE `vsub_c`: vector subtraction. */
  vsub(a: SpiceVector3, b: SpiceVector3): SpiceVector3;
  /** SPICE `vminus_c`: negate a vector. */
  vminus(v: SpiceVector3): SpiceVector3;
  /** SPICE `vscl_c`: multiply vector by scalar. */
  vscl(s: number, v: SpiceVector3): SpiceVector3;

  /** SPICE `mxm_c`: matrix-matrix multiplication. */
  mxm(a: Mat3RowMajor, b: Mat3RowMajor): Mat3RowMajor;

  /**
   * Generate a rotation matrix representing a rotation about a coordinate axis.
   *
   * Angle is in radians; this rotates the coordinate system.
   * Axis is 1=x, 2=y, 3=z; other signed 32-bit integer axes are reduced modulo 3.
   * Non-integral or overflowing axes throw before CSPICE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rotate_c.html
   */
  rotate(angle: number, axis: number): Mat3RowMajor;

  /**
   * Rotate a matrix about a coordinate axis.
   *
   * Returns the left product rotate(angle, axis) * m in row-major order.
   * Angle is in radians; signed 32-bit integer axis indices are reduced modulo 3.
   * Non-integral or overflowing axes throw before CSPICE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rotmat_c.html
   */
  rotmat(m: Mat3RowMajor, angle: number, axis: number): Mat3RowMajor;

  /**
   * Rotate vectors about an arbitrary axis by an angle in radians.
   * The axis is normalized; a zero axis produces the identity matrix.
   * Returns a length-nine matrix in row-major order.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/axisar_c.html
   */
  axisar(axis: SpiceVector3, angle: number): Mat3RowMajor;

  /** SPICE `georec_c`: geodetic lon/lat/alt -> rectangular coordinates. */
  georec(
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
  ): SpiceVector3;
  /** SPICE `recgeo_c`: rectangular -> geodetic lon/lat/alt coordinates. */
  recgeo(
    rect: SpiceVector3,
    re: number,
    f: number,
  ): { lon: number; lat: number; alt: number };

  /** SPICE `mxv_c`: multiply matrix by vector. */
  mxv(m: Mat3RowMajor, v: SpiceVector3): SpiceVector3;
  /** SPICE `mtxv_c`: multiply transpose(matrix) by vector. */
  mtxv(m: Mat3RowMajor, v: SpiceVector3): SpiceVector3;
}
