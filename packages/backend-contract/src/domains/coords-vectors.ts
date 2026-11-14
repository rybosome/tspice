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
   * Clear the first ndim fixed-width character rows in a copy of bytes.
   * Each row occupies arrlen bytes including its terminator. CSPICE fills
   * the first arrlen - 1 bytes with ASCII spaces and the last byte with NUL.
   * The returned byte values include the entire untouched suffix. Input
   * entries must be integers from 0 to 255. No text decoding is performed.
   *
   * ndim and arrlen are signed 32-bit integers. A nonpositive ndim leaves
   * all bytes intact, including for widths below two. For positive ndim,
   * arrlen below two signals SPICE(STRINGTOOSHORT). Otherwise the complete
   * rows must fit in the supplied byte array.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/clearc_c.html
   */
  clearc(ndim: number, arrlen: number, bytes: readonly number[]): number[];

  /**
   * Set the first ndim doubles to positive zero in a copy of values.
   * Return the entire array, preserving the untouched suffix. A nonpositive
   * ndim leaves all entries intact. ndim must be a signed 32-bit integer
   * and a positive count must fit in the supplied storage. Double entries
   * can include signed zero, infinities and NaN.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cleard_c.html
   */
  cleard(ndim: number, values: readonly number[]): number[];

  /**
   * Set the first ndim signed 32-bit integers to zero in a copy of values.
   * Return the complete array, including its untouched suffix. A nonpositive
   * ndim leaves all entries intact. ndim must be a signed 32-bit integer
   * and a positive count must fit in the supplied storage.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cleari_c.html
   */
  cleari(ndim: number, values: readonly number[]): number[];

  /**
   * Fill the first ndim entries in a copy of values with the supplied double.
   * Return the complete array, including its untouched suffix. A nonpositive
   * ndim leaves all entries intact. ndim must be a signed 32-bit integer
   * and a positive count must fit in the supplied storage. The fill value
   * and array entries can include signed zero, infinities and NaN.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/filld_c.html
   */
  filld(value: number, ndim: number, values: readonly number[]): number[];

  /**
   * Fill the first ndim entries in a copy of values with the signed 32-bit
   * integer value. Return the complete integer array, including its untouched
   * suffix. A nonpositive ndim leaves all entries intact. ndim must be a
   * signed 32-bit integer and a positive count must fit in the supplied storage.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/filli_c.html
   */
  filli(value: number, ndim: number, values: readonly number[]): number[];

  /**
   * Copy ndim doubles from the start of source into a copy of destination.
   * Return the complete destination with its untouched suffix. Inputs are
   * snapshotted independently, including when the same array is supplied
   * twice. Zero count returns a copy of the original destination.
   *
   * ndim must be a nonnegative signed 32-bit integer that fits in both arrays.
   * Negative counts are rejected before calling the pinned CSPICE routine,
   * which passes its count to memmove as an unsigned number of bytes.
   * Double entries can include signed zero, infinities and NaN.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/moved_c.html
   */
  moved(
    source: readonly number[],
    ndim: number,
    destination: readonly number[],
  ): number[];

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
