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
   * Return the linear combination a * v1 + b * v2 as a new vector.
   *
   * Coefficients and three-component vectors must be finite. Inputs are not
   * modified. Arithmetic retains CSPICE overflow, underflow and cancellation
   * behavior; finite inputs can produce nonfinite results. No kernels are
   * needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vlcom_c.html
   */
  vlcom(
    a: number,
    v1: Readonly<SpiceVector3>,
    b: number,
    v2: Readonly<SpiceVector3>,
  ): SpiceVector3;

  /**
   * Return a * v1 + b * v2 + c * v3 as a new vector.
   *
   * Arguments alternate coefficients and their three-component vectors.
   * All inputs must be finite and are not modified. CSPICE does not guard
   * against overflow or underflow; nonfinite results and cancellation retain
   * its floating-point behavior. No kernels are needed. CSPICE is error-free;
   * invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vlcom3_c.html
   */
  vlcom3(
    a: number,
    v1: Readonly<SpiceVector3>,
    b: number,
    v2: Readonly<SpiceVector3>,
    c: number,
    v3: Readonly<SpiceVector3>,
  ): SpiceVector3;

  /**
   * Return the component of a perpendicular to b as a new vector.
   *
   * Both vectors must contain exactly three finite numbers in the same frame.
   * The pinned CSPICE N0067 implementation returns [0, 0, 0] if either input
   * is zero, including a nonzero a with zero b. This follows its executable
   * behavior despite the different zero-b statement in the NAIF prose.
   * Reciprocal scaling and cancellation retain CSPICE numerical limits;
   * finite extreme inputs can produce nonfinite results. No kernels are
   * needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vperp_c.html
   */
  vperp(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): SpiceVector3;

  /**
   * Return the projection of a onto b as a new vector.
   *
   * Both vectors must contain exactly three finite numbers in the same frame.
   * A zero input produces [0, 0, 0]. Reciprocal scaling retains CSPICE
   * numerical limits, including nonfinite results from extreme finite inputs.
   * No kernels are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vproj_c.html
   */
  vproj(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): SpiceVector3;

  /**
   * Return the relative difference norm(a - b) / max(norm(a), norm(b)).
   *
   * Both vectors must contain exactly three finite numbers in the same frame.
   * Equal vectors, including two zero vectors, return zero. The result is
   * dimensionless. CSPICE overflow and underflow can affect the nominal [0, 2]
   * range and can produce nonfinite results. No kernels are needed. CSPICE is
   * error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vrel_c.html
   */
  vrel(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): number;

  /**
   * Rotate v about an arbitrary axis by theta radians, returning a new vector.
   *
   * This is an active, right-handed vector rotation; positive pi/2 about +Z
   * maps +X to +Y. CSPICE normalizes the axis; a zero axis returns a copy of v.
   * Vectors must contain exactly three finite numbers and theta must be finite.
   * Numerical results retain CSPICE scaling, cancellation and overflow behavior.
   * No kernels are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vrotv_c.html
   */
  vrotv(
    v: Readonly<SpiceVector3>,
    axis: Readonly<SpiceVector3>,
    theta: number,
  ): SpiceVector3;

  /**
   * Express v in a coordinate system rotated by angle radians about axis.
   *
   * This is a coordinate rotation: positive pi/2 about axis 3 maps +X to -Y.
   * Axis 1=X, 2=Y, 3=Z; other signed 32-bit integer axes are reduced modulo 3
   * by CSPICE. Nonintegral or overflowing axis values throw before CSPICE.
   * The vector must contain exactly three finite numbers and angle must be
   * finite. The output is independent of v and retains CSPICE floating-point
   * limits. No kernels are needed. CSPICE is error-free.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rotvec_c.html
   */
  rotvec(v: Readonly<SpiceVector3>, angle: number, axis: number): SpiceVector3;

  /**
   * Return the scalar product transpose(v1) * matrix * v2.
   *
   * The matrix contains nine finite numbers in row-major order; it is not
   * transposed. Both vectors must contain exactly three finite numbers. Inputs
   * are not modified. Summation retains CSPICE overflow, underflow and
   * cancellation behavior, including nonfinite results from finite inputs.
   * No kernels are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vtmv_c.html
   */
  vtmv(
    v1: Readonly<SpiceVector3>,
    matrix: Mat3RowMajor,
    v2: Readonly<SpiceVector3>,
  ): number;

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
