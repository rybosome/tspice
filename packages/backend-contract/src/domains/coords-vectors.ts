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
   * Evaluate a Chebyshev expansion and its first nderiv derivatives at x.
   *
   * cp[i] multiplies the first-kind Chebyshev polynomial T_i(s), with
   * s = (x - x2s[0]) / x2s[1]; degree is cp.length - 1. cp must be nonempty.
   * The independent result array has nderiv + 1 entries, starting with the
   * value, followed by derivatives with respect to x (not s). nderiv must
   * be an integer in [0, 715827881], keeping the pinned toolkit's workspace
   * indices within signed32. Workspace is allocated internally.
   *
   * For reliable evaluation, use a nonzero transformation scale x2s[1]
   * and normalized s in [-1, 1]. Inputs are not clamped: negative scales,
   * zero scales and extrapolation reach CSPICE unchanged. Zero scales do
   * not define a valid normalization; extrapolation and high derivative
   * orders can cause severe numerical error or overflow.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbder_c.html
   */
  chbder(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
    nderiv: number,
  ): number[];

  /**
   * Evaluate a Chebyshev expansion and its integral at x.
   *
   * cp[i] multiplies T_i(s), where s = (x - x2s[0]) / x2s[1]; degree is
   * cp.length - 1. Return { p, itgrlp }, where p is the expansion value and
   * itgrlp is its integral with respect to x, chosen to be zero at x2s[0].
   * An empty cp reaches CSPICE as degree -1 and signals INVALIDDEGREE.
   * A nonpositive x2s[1] signals INVALIDRADIUS; these are CSPICE errors.
   * For reliable evaluation use normalized s in [-1, 1]. No clamping or
   * overflow checks are performed; large degree can accumulate roundoff.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbigr_c.html
   */
  chbigr(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): { p: number; itgrlp: number };

  /**
   * Evaluate a Chebyshev expansion and its first derivative at x.
   *
   * cp[i] multiplies T_i(s), with s = (x - x2s[0]) / x2s[1]; degree is
   * cp.length - 1. cp must be nonempty. Return { p, dpdx }, preserving the
   * value and derivative with respect to x (not s).
   * Use a nonzero scale x2s[1] and normalized s in [-1, 1] for reliable
   * evaluation. Finite scales and abscissae reach CSPICE unchanged; a zero
   * scale is not a valid normalization and extrapolation can overflow.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbint_c.html
   */
  chbint(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): { p: number; dpdx: number };

  /**
   * Evaluate a Chebyshev expansion at x.
   *
   * cp[i] multiplies T_i(s), with s = (x - x2s[0]) / x2s[1]; degree is
   * cp.length - 1. cp must be nonempty. Use a nonzero scale x2s[1] and
   * normalized s in [-1, 1] for reliable evaluation. Finite scales and
   * abscissae reach CSPICE unchanged; a zero scale is not a valid
   * normalization and extrapolation can overflow.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbval_c.html
   */
  chbval(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): number;

  /**
   * Evaluate an ordinary polynomial and its first nderiv derivatives at t.
   *
   * coeffs[i] is the coefficient of t^i; degree is coeffs.length - 1.
   * Return an independent array starting with the polynomial value,
   * followed by successive derivatives. Empty coefficients imply degree
   * -1 and yield nderiv + 1 zeros when nderiv is nonnegative. A negative
   * signed32 nderiv invokes CSPICE's no-write path and returns [].
   * Nonnegative nderiv must be at most 2147483646 to keep the pinned
   * translated loop counter within signed32. High derivative orders can
   * grow rapidly and overflow; results are not replaced or normalized.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/polyds_c.html
   */
  polyds(coeffs: readonly number[], nderiv: number, t: number): number[];

  /**
   * Return both roots of a*x^2 + b*x + c = 0 as complex pairs.
   *
   * Return { root1, root2 }, each an independent [real, imaginary] array.
   * For a nonzero quadratic coefficient, root1 corresponds to the positive
   * square-root term in the quadratic formula and root2 to the negative
   * term; this does not sort roots or guarantee positive root1 imaginary
   * part when a is negative. A linear equation (a = 0, b != 0) returns the
   * same root in both arrays. If a and b are both zero, CSPICE signals
   * DEGENERATECASE. The pinned toolkit's degenerate-case path may also write
   * a NAMESDONOTMATCH trace diagnostic; the raised CSPICE error remains
   * DEGENERATECASE. CSPICE scales coefficients when possible but does not
   * check root overflow; all numerical outputs are retained.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rquad_c.html
   */
  rquad(
    a: number,
    b: number,
    c: number,
  ): { root1: [number, number]; root2: [number, number] };

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
