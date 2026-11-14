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
   * Return the Euclidean distance between two three-dimensional vectors.
   *
   * Distance uses the input units. CSPICE subtracts a - b before computing
   * the norm; unrepresentable differences or norms can overflow or yield NaN.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vdist_c.html
   */
  vdist(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): number;

  /**
   * Return an independent copy of a three-dimensional vector.
   *
   * Every component, including signed zero, is retained; the input is not modified.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vequ_c.html
   */
  vequ(v: Readonly<SpiceVector3>): SpiceVector3;

  /**
   * Pack scalar components into a new [x, y, z] vector.
   *
   * All components must be finite. Component order and signed zero are retained.
   * No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vpack_c.html
   */
  vpack(x: number, y: number, z: number): SpiceVector3;

  /**
   * Unpack a three-dimensional vector into its x, y, and z components.
   *
   * Component order and signed zero are retained; the input is not modified.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vupack_c.html
   */
  vupack(v: Readonly<SpiceVector3>): { x: number; y: number; z: number };

  /**
   * Return whether all three vector components equal zero.
   *
   * Positive and negative zero both count as zero. No tolerance is applied;
   * a nonzero subnormal component makes the result false.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vzero_c.html
   */
  vzero(v: Readonly<SpiceVector3>): boolean;

  /**
   * Return a vector normalized to unit length and its Euclidean norm.
   *
   * The zero vector produces unit [0, 0, 0] and norm 0. The returned unit
   * vector is independent of the input. Norm uses the input units; a norm
   * exceeding the representable range can be infinite, as in CSPICE.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/unorm_c.html
   */
  unorm(v: Readonly<SpiceVector3>): { unit: SpiceVector3; norm: number };

  /**
   * Return the normalized cross product a x b as an independent vector.
   *
   * Order is significant. A zero input or an exactly zero computed cross
   * product returns [0, 0, 0]. Near parallelism, normalization can amplify
   * roundoff; nominally parallel inputs can produce build-dependent directions.
   * CSPICE scales each input before crossing to reduce overflow/underflow.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ucrss_c.html
   */
  ucrss(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): SpiceVector3;

  /**
   * Return the angular separation of two vectors in radians, in [0, pi].
   *
   * Inputs must use the same reference frame. A zero input yields 0;
   * opposed vectors yield pi. Results retain CSPICE floating-point behavior
   * when intermediate norms exceed the representable range.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vsep_c.html
   */
  vsep(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): number;

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
