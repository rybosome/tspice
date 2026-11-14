/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type {
  Mat3RowMajor,
  SpiceVector3,
  SpiceStateVector,
} from "../shared/types.js";

/** Backend contract for basic coordinate transforms and vector/matrix math. */
export interface CoordsVectorsApi {
  /**
   * Return the unit cross-product direction of the positions in a and b,
   * together with its derivative, as a new six-component state.
   *
   * Pinned N0067 scales each complete input state by the reciprocal of its
   * largest absolute position component, leaving a zero position unscaled.
   * If the cross product of these scaled positions computes exactly zero,
   * the output position is zero and its derivative is the cross-product
   * derivative of the internally scaled states. This can differ from the
   * unscaled derivative described by the NAIF prose. Near collinearity,
   * normalization can amplify rounding and compiler-dependent residuals.
   * NAIF requires magnitudes that avoid intermediate overflow; scaling does
   * not remove that caller requirement.
   * The first three outputs are dimensionless; the last three normally have
   * inverse time units, with the zero-cross convention described above.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ducrss_c.html
   */
  ducrss(
    a: Readonly<SpiceStateVector>,
    b: Readonly<SpiceStateVector>,
  ): SpiceStateVector;

  /**
   * Return [cross(p1, p2), cross(v1, p2) + cross(p1, v2)] as a new state,
   * where a=[p1,v1] and b=[p2,v2].
   *
   * The output position has the product of the input position units; the
   * last three components are its derivative. Cross products and addition
   * retain CSPICE overflow, underflow and cancellation behavior.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvcrss_c.html
   */
  dvcrss(
    a: Readonly<SpiceStateVector>,
    b: Readonly<SpiceStateVector>,
  ): SpiceStateVector;

  /**
   * Return the derivative dot(p1, v2) + dot(v1, p2),
   * where a=[p1,v1] and b=[p2,v2].
   *
   * This is the derivative of the position dot product, not a six-dimensional
   * dot product. Output units are the product of the position units divided
   * by the common derivative parameter's unit. CSPICE summation and numerical
   * limits are preserved. NAIF requires input magnitudes that avoid overflow
   * during the products and summation.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvdot_c.html
   */
  dvdot(a: Readonly<SpiceStateVector>, b: Readonly<SpiceStateVector>): number;

  /**
   * Return the unit position direction and its derivative as a new state.
   *
   * For nonzero position p with derivative v, the result is [u, du/dt],
   * where u=p/norm(p). If the computed position norm is zero, CSPICE returns
   * a zero position and copies the original last three components unchanged.
   * The usual output units are dimensionless direction and inverse time;
   * the zero-position convention retains the input derivative units.
   * Scaling, projection and reciprocal-norm numerical limits are preserved.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvhat_c.html
   */
  dvhat(state: Readonly<SpiceStateVector>): SpiceStateVector;

  /**
   * Return the derivative of the norm of state's first three components.
   *
   * The result is the input derivative projected onto the unit position
   * direction, with the same units as the last three input components.
   * If the position norm computes as zero, CSPICE returns zero. The actual
   * normalization and dot-product numerical limits are preserved.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvnorm_c.html
   */
  dvnorm(state: Readonly<SpiceStateVector>): number;

  /**
   * Return the derivative of the angular separation of the two positions,
   * in radians per unit of the common derivative parameter (normally time).
   *
   * The states must refer to the same observer, frame and epoch. When the
   * cross product of their normalized positions computes exactly zero,
   * CSPICE returns zero, including zero-position, parallel and opposed cases;
   * the classical derivative need not exist at these singularities. Normalizing
   * mathematically collinear positions can leave a nonzero cross-product
   * residual; the resulting derivative is sensitive to rounding and compiler
   * arithmetic. Nearly collinear states can be poorly conditioned. Pinned
   * N0067's guarded division returns zero for sufficiently small quotients
   * and raises genuine CSPICE errors for detected numeric overflow or division
   * by zero. These errors propagate; they are not converted to scalar zero results.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvsep_c.html
   */
  dvsep(a: Readonly<SpiceStateVector>, b: Readonly<SpiceStateVector>): number;

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
