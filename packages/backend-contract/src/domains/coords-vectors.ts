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
   * Evaluate an equally spaced Hermite interpolating polynomial at x.
   *
   * For point first + i * step, yvals[2*i] is the function value and
   * yvals[2*i+1] its first derivative with respect to the abscissa.
   * yvals must have even length; n = yvals.length / 2. Return { f, df },
   * the polynomial value and derivative at x. Negative step is allowed;
   * zero step signals CSPICE(INVALIDSTEPSIZE). No points signals
   * CSPICE(INVALIDSIZE). The maximum n is 67108863, keeping the pinned
   * CSPICE wrapper's internal 32*n workspace byte count within signed32.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/hrmesp_c.html
   */
  hrmesp(
    first: number,
    step: number,
    yvals: readonly number[],
    x: number,
  ): { f: number; df: number };

  /**
   * Evaluate a Hermite interpolating polynomial at x.
   *
   * xvals contains the abscissae; yvals must have exactly twice as many
   * entries, interleaving function value and first derivative for each
   * point. Return { f, df }, the value and derivative with respect to the
   * abscissa. Input order is preserved. Duplicate abscissae signal
   * CSPICE(DIVIDEBYZERO); no points signals CSPICE(INVALIDSIZE).
   * The maximum point count is 357913941, keeping the pinned translated
   * routine's intermediate 6*n-1 workspace index within signed32.
   * The internal workspace contains 4*n doubles.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/hrmint_c.html
   */
  hrmint(
    xvals: readonly number[],
    yvals: readonly number[],
    x: number,
  ): { f: number; df: number };

  /**
   * Evaluate a Lagrange polynomial on equally spaced points at x.
   *
   * yvals[i] is the function value at first + i * step. The inferred point
   * count is yvals.length. Negative step is allowed; zero step signals
   * CSPICE(INVALIDSTEPSIZE). No points signals CSPICE(INVALIDSIZE).
   * The maximum point count is 268435455, keeping the pinned wrapper's
   * internal 8*n workspace byte count within signed32.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgresp_c.html
   */
  lgresp(
    first: number,
    step: number,
    yvals: readonly number[],
    x: number,
  ): number;

  /**
   * Evaluate a Lagrange polynomial and its derivative at x.
   *
   * xvals and yvals must have equal lengths and give corresponding
   * abscissae and values. Return { p, dp }, the value and derivative with
   * respect to the abscissa. NAIF specifies distinct, increasing xvals;
   * this raw wrapper preserves input order without sorting or deduplication.
   * Duplicates signal CSPICE(DIVIDEBYZERO); no points signals
   * CSPICE(INVALIDSIZE). The maximum point count is 715827882, keeping the
   * pinned translated routine's intermediate 3*n index within signed32.
   * The internal workspace contains 2*n doubles.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgrind_c.html
   */
  lgrind(
    xvals: readonly number[],
    yvals: readonly number[],
    x: number,
  ): { p: number; dp: number };

  /**
   * Evaluate a Lagrange interpolating polynomial at x.
   *
   * xvals and yvals must have equal lengths and give corresponding
   * abscissae and values. NAIF specifies distinct, increasing xvals;
   * this raw wrapper preserves input order without sorting or deduplication.
   * Duplicates signal CSPICE(DIVIDEBYZERO); no points signals
   * CSPICE(INVALIDSIZE). The maximum point count is 268435455, keeping the
   * pinned wrapper's internal 8*n workspace byte count within signed32.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgrint_c.html
   */
  lgrint(xvals: readonly number[], yvals: readonly number[], x: number): number;

  /**
   * Estimate a vector function's derivative at the midpoint of two samples.
   *
   * f0 and f2 contain function values at abscissae separated by 2*delta.
   * They must have equal, nonzero lengths. delta may be negative; zero
   * signals CSPICE(DIVIDEBYZERO). Return an independent array containing
   * the actual CSPICE derivative estimates. The pinned routine forms
   * (0.5/delta)*f2 + (-0.5/delta)*f0; its overflow, underflow and cancellation
   * behavior can differ from subtracting first and dividing afterwards.
   * Empty vectors are rejected because NAIF does not define a portable
   * zero-dimensional call. The maximum dimension is 2147483646 to avoid
   * overflow of the pinned translated routine's inclusive loop counter.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/qderiv_c.html
   */
  qderiv(f0: readonly number[], f2: readonly number[], delta: number): number[];

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
