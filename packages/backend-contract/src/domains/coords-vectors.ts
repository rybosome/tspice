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
   * Return the CSPICE value of pi (a half turn in radians).
   *
   * Dimensionless circle circumference-to-diameter ratio.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pi_c.html
   */
  pi(): number;

  /**
   * Return twice the CSPICE value of pi (a full turn in radians).
   *
   * The result is 2 * pi.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/twopi_c.html
   */
  twopi(): number;

  /**
   * Return half the CSPICE value of pi (a quarter turn in radians).
   *
   * The result is pi / 2.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/halfpi_c.html
   */
  halfpi(): number;

  /**
   * Return the number of degrees per radian.
   *
   * Multiply an angle in radians by this value to obtain degrees.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dpr_c.html
   */
  dpr(): number;

  /**
   * Return the number of radians per degree.
   *
   * Multiply an angle in degrees by this value to obtain radians.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rpd_c.html
   */
  rpd(): number;

  /**
   * Return the speed of light in vacuum: 299792.458 kilometers per second.
   *
   * This is the IAU value used by CSPICE.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/clight_c.html
   */
  clight(): number;

  /**
   * Return the largest finite double-precision value supported by CSPICE.
   *
   * The value is toolkit/platform dependent (DBL_MAX); on supported
   * IEEE-754 binary64 backends it equals Number.MAX_VALUE.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dpmax_c.html
   */
  dpmax(): number;

  /**
   * Return the most negative finite double-precision value supported by CSPICE.
   *
   * On supported backends this is -DBL_MAX (-Number.MAX_VALUE),
   * not the smallest positive representable number.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dpmin_c.html
   */
  dpmin(): number;

  /**
   * Return the largest integer representable by the toolkit SpiceInt type.
   *
   * The supported Node/WASM backends use signed 32-bit SpiceInt,
   * so the result is 2147483647, represented exactly as a JavaScript number.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The integer CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/intmax_c.html
   */
  intmax(): number;

  /**
   * Return the smallest integer representable by the toolkit SpiceInt type.
   *
   * The supported Node/WASM backends use signed 32-bit SpiceInt,
   * so the result is -2147483648, represented exactly as a JavaScript number.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The integer CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/intmin_c.html
   */
  intmin(): number;

  /**
   * Convert cylindrical coordinates to latitudinal coordinates.
   *
   * Input radius is distance from the Z axis; z is height above the XY plane.
   * Longitude passes through unchanged. Latitude is atan2(z, radius),
   * in [-pi, pi]; radius and latitude are zero at the origin.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cyllat_c.html
   */
  cyllat(
    radius: number,
    lon: number,
    z: number,
  ): { radius: number; lon: number; lat: number };

  /**
   * Convert cylindrical coordinates to a rectangular [x, y, z] vector.
   *
   * Input radius is distance from the Z axis; z is height above the XY plane.
   * Returns a new independent vector. Negative radius retains CSPICE behavior.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cylrec_c.html
   */
  cylrec(radius: number, lon: number, z: number): SpiceVector3;

  /**
   * Convert cylindrical coordinates to spherical coordinates.
   *
   * Input radius is distance from the Z axis; z is height above the XY plane.
   * Longitude passes through unchanged. Colatitude is atan2(radius, z),
   * in [-pi, pi]; radius and colatitude are zero at the origin.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cylsph_c.html
   */
  cylsph(
    radius: number,
    lon: number,
    z: number,
  ): { radius: number; colat: number; lon: number };

  /**
   * Convert latitudinal coordinates to cylindrical coordinates.
   *
   * Input radius is distance from the origin. Output radius is distance
   * from the Z axis and z is height above the XY plane. Longitude passes
   * through unchanged; negative radii and unrestricted angles are accepted.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/latcyl_c.html
   */
  latcyl(
    radius: number,
    lon: number,
    lat: number,
  ): { radius: number; lon: number; z: number };

  /**
   * Convert latitudinal coordinates to spherical coordinates.
   *
   * Radius and longitude pass through unchanged. Colatitude is pi/2 - lat.
   * Negative radii and unrestricted angles are accepted without normalization.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/latsph_c.html
   */
  latsph(
    radius: number,
    lon: number,
    lat: number,
  ): { radius: number; colat: number; lon: number };

  /**
   * Convert a rectangular [x, y, z] vector to cylindrical coordinates.
   *
   * Output radius is distance from the Z axis; z preserves the input height.
   * Longitude is in [0, 2*pi] and is zero on the Z axis. Input must contain
   * exactly three finite numbers; it is not modified.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/reccyl_c.html
   */
  reccyl(rect: Readonly<SpiceVector3>): {
    radius: number;
    lon: number;
    z: number;
  };

  /**
   * Convert spherical coordinates to cylindrical coordinates.
   *
   * Input radius is distance from the origin. Output radius is distance
   * from the Z axis and z is height above the XY plane. Longitude passes
   * through unchanged; negative radii and unrestricted angles are accepted.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sphcyl_c.html
   */
  sphcyl(
    radius: number,
    colat: number,
    lon: number,
  ): { radius: number; lon: number; z: number };

  /**
   * Convert spherical coordinates to latitudinal coordinates.
   *
   * Radius and longitude pass through unchanged. Latitude is pi/2 - colat.
   * Negative radii and unrestricted angles are accepted without normalization.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sphlat_c.html
   */
  sphlat(
    radius: number,
    colat: number,
    lon: number,
  ): { radius: number; lon: number; lat: number };

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
