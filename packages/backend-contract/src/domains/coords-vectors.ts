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
   * Return the component-wise sum a + b as an independent array.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * Input arrays must have equal lengths; the length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Empty inputs return an independent empty array. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vaddg_c.html
   */
  vaddg(a: readonly number[], b: readonly number[]): number[];

  /**
   * Return the Euclidean distance between a and b.
   *
   * Equal vectors and two empty vectors return zero. CSPICE scales the norm,
   * but component subtraction and the final norm can still overflow.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * Input arrays must have equal lengths; the length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vdistg_c.html
   */
  vdistg(a: readonly number[], b: readonly number[]): number;

  /**
   * Return the dot product of a and b, accumulated in component order.
   *
   * Two empty vectors return zero. Products and accumulation retain CSPICE
   * overflow, underflow and cancellation behavior.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * Input arrays must have equal lengths; the length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vdotg_c.html
   */
  vdotg(a: readonly number[], b: readonly number[]): number;

  /**
   * Return an independent copy of v, preserving every component and signed zero.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * The array length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Empty inputs return an independent empty array.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vequg_c.html
   */
  vequg(v: readonly number[]): number[];

  /**
   * Return a normalized copy of v.
   *
   * A zero vector produces a zero vector; an empty vector produces [].
   * Normalization uses CSPICE's computed norm and retains its floating-point
   * limits, including a zero result when a finite vector's norm overflows.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * The array length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Empty inputs return an independent empty array. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vhatg_c.html
   */
  vhatg(v: readonly number[]): number[];

  /**
   * Return a * v1 + b * v2 as an independent array.
   *
   * Arguments alternate coefficients and vectors; dimension is inferred from
   * the vectors. Coefficients must be finite. Products and summation retain
   * CSPICE overflow, underflow and cancellation behavior.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * Input arrays must have equal lengths; the length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Empty inputs return an independent empty array. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vlcomg_c.html
   */
  vlcomg(
    a: number,
    v1: readonly number[],
    b: number,
    v2: readonly number[],
  ): number[];

  /**
   * Return the component-wise negation of v as an independent array.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * The array length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Empty inputs return an independent empty array.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vminug_c.html
   */
  vminug(v: readonly number[]): number[];

  /**
   * Return the Euclidean norm of v using CSPICE's scaled calculation.
   *
   * Zero and empty vectors return zero. Scaling does not prevent overflow
   * when the resulting norm is outside the representable double range.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * The array length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vnormg_c.html
   */
  vnormg(v: readonly number[]): number;

  /**
   * Return the projection of a onto b as an independent array.
   *
   * CSPICE uses dot(a, b) / dot(b, b) to scale b. A zero computed denominator
   * produces a zero vector, including underflow of dot(b, b). Ordinary dot
   * products can overflow; these numerical limits are preserved.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * Input arrays must have equal lengths; the length supplies the dimension.
   * Dimensions above 2147483646 are rejected to avoid the pinned toolkit's
   * translated-loop integer overflow.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Empty inputs return an independent empty array. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vprojg_c.html
   */
  vprojg(a: readonly number[], b: readonly number[]): number[];

  /**
   * Return distance(a, b) / max(norm(a), norm(b)).
   *
   * Equal vectors, including two zero or empty vectors, return zero. The
   * result is dimensionless. CSPICE's subtraction, scaling and division
   * retain their overflow and underflow limits.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * Input arrays must have equal lengths; the length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vrelg_c.html
   */
  vrelg(a: readonly number[], b: readonly number[]): number;

  /**
   * Return s * v as an independent array.
   *
   * The scale s must be finite. Products retain CSPICE overflow, underflow
   * and signed-zero behavior.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * The array length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Empty inputs return an independent empty array. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vsclg_c.html
   */
  vsclg(s: number, v: readonly number[]): number[];

  /**
   * Return the angular separation of a and b in radians, nominally in [0, pi].
   *
   * If either computed norm is zero, the result is zero, including empty
   * vectors. This general-dimensional routine retains its raw dot-product
   * and reciprocal-norm arithmetic: dot-product underflow can select pi/2,
   * even for parallel tiny vectors, and nearly parallel or opposed vectors
   * can lose precision. Extreme finite inputs can produce nonfinite results.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * Input arrays must have equal lengths; the length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vsepg_c.html
   */
  vsepg(a: readonly number[], b: readonly number[]): number;

  /**
   * Return the component-wise difference a - b as an independent array.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * Input arrays must have equal lengths; the length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Empty inputs return an independent empty array. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vsubg_c.html
   */
  vsubg(a: readonly number[], b: readonly number[]): number[];

  /**
   * Return whether every component of the nonempty vector v is exactly zero.
   *
   * Both signs of zero count as zero. An empty vector returns false, matching
   * CSPICE's nonpositive-dimension rule; no norm or tolerance is used.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * The array length supplies the dimension.
   * The dimension must fit a signed 32-bit integer.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vzerog_c.html
   */
  vzerog(v: readonly number[]): boolean;

  /**
   * Return { unit, norm }, containing a normalized copy of v and its norm.
   *
   * A zero vector returns a zero unit array and norm zero; an empty vector
   * returns { unit: [], norm: 0 }. Norm and every unit component are the actual
   * CSPICE outputs, including overflow and underflow effects.
   *
   * Vector inputs are readonly arrays of finite numbers and are not modified.
   * The array length supplies the dimension.
   * Dimensions above 2147483646 are rejected to avoid the pinned toolkit's
   * translated-loop integer overflow.
   * WASM additionally limits each vector buffer to 256 MiB. No kernels are
   * needed. Numerical results
   * retain CSPICE behavior, including nonfinite output from finite input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/unormg_c.html
   */
  unormg(v: readonly number[]): { unit: number[]; norm: number };

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
