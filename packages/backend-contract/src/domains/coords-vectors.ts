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
   * Bracket value within the closed interval bounded by end1 and end2.
   *
   * The endpoint order is immaterial. Values inside the interval are returned
   * unchanged; otherwise CSPICE returns the nearer endpoint. All arguments
   * must be finite numbers. No kernels are needed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/brcktd_c.html
   */
  brcktd(value: number, end1: number, end2: number): number;

  /**
   * Bracket an integer value within the closed interval bounded by end1 and end2.
   *
   * The endpoint order is immaterial. Values inside the interval are returned
   * unchanged; otherwise CSPICE returns the nearer endpoint. All three inputs
   * must be signed 32-bit integers; fractional or out-of-range values throw
   * before CSPICE. No kernels are needed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/brckti_c.html
   */
  brckti(value: number, end1: number, end2: number): number;

  /**
   * Convert a finite measurement value from inUnit to outUnit.
   *
   * Unit names are case-insensitive and use CSPICE's supported angle, distance
   * or time names and aliases. Strings are passed unchanged; embedded NUL is
   * rejected. Empty, unrecognized or incompatible units raise CSPICE errors.
   * No kernels are needed. The conversion uses the pinned toolkit's constants,
   * including its historical estimates for AU, parsecs and tropical years.
   * Overflow is not checked by CSPICE; nonfinite output from finite input is
   * preserved, so choose units and magnitudes within the desired numeric range.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/convrt_c.html
   */
  convrt(value: number, inUnit: string, outUnit: string): number;

  /**
   * Return CSPICE's ordered sum of all values, starting from zero.
   *
   * values must be a dense readonly array of finite numbers; the element count
   * must fit a signed 32-bit integer. An empty array returns zero. The input
   * is not modified. CSPICE's ordinary double-precision accumulation retains
   * rounding, cancellation and overflow, including nonfinite results. No
   * kernels are needed. WASM additionally limits the input buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sumad_c.html
   */
  sumad(values: readonly number[]): number;

  /**
   * Return CSPICE's ordered sum of all signed 32-bit integer values.
   *
   * values must be a dense readonly array whose length fits a signed 32-bit
   * integer. An empty array returns zero; the input is not modified. Every
   * prefix sum, starting from zero, must remain within [-2147483648, 2147483647].
   * Otherwise a RangeError is raised before calling CSPICE, even when the final
   * mathematical sum would fit. This guard excludes undefined C signed-overflow
   * behavior; it does not supply wraparound or replace the CSPICE result.
   * No kernels are needed. WASM additionally limits the input buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sumai_c.html
   */
  sumai(values: readonly number[]): number;

  /**
   * Return the maximum of values using the actual variadic CSPICE routine.
   *
   * values must be a dense readonly array of finite numbers containing
   * 0 to 30 elements, CSPICE's documented portable argument limit. An empty
   * array returns zero. The array length supplies the C argument count and
   * the input is not modified. Invalid values or longer arrays throw before
   * CSPICE. No kernels are needed.
   * Equal extrema retain the first occurrence, including its signed zero.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/maxd_c.html
   */
  maxd(values: readonly number[]): number;

  /**
   * Return the maximum of values using the actual variadic CSPICE routine.
   *
   * values must be a dense readonly array of signed 32-bit integers containing
   * 0 to 30 elements, CSPICE's documented portable argument limit. An empty
   * array returns zero. The array length supplies the C argument count and
   * the input is not modified. Invalid values or longer arrays throw before
   * CSPICE. No kernels are needed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/maxi_c.html
   */
  maxi(values: readonly number[]): number;

  /**
   * Return the minimum of values using the actual variadic CSPICE routine.
   *
   * values must be a dense readonly array of finite numbers containing
   * 0 to 30 elements, CSPICE's documented portable argument limit. An empty
   * array returns zero. The array length supplies the C argument count and
   * the input is not modified. Invalid values or longer arrays throw before
   * CSPICE. No kernels are needed.
   * Equal extrema retain the last occurrence, including its signed zero.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mind_c.html
   */
  mind(values: readonly number[]): number;

  /**
   * Return the minimum of values using the actual variadic CSPICE routine.
   *
   * values must be a dense readonly array of signed 32-bit integers containing
   * 0 to 30 elements, CSPICE's documented portable argument limit. An empty
   * array returns zero. The array length supplies the C argument count and
   * the input is not modified. Invalid values or longer arrays throw before
   * CSPICE. No kernels are needed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mini_c.html
   */
  mini(values: readonly number[]): number;

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
