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
   * Convert range, azimuth and elevation to a new rectangular vector.
   *
   * Angles are radians. azccw=true measures azimuth from +X toward +Y;
   * false measures clockwise. elplsz=true measures elevation toward +Z;
   * false toward -Z. Negative range and angles outside their usual ranges
   * are passed through without normalization. Distance units are preserved.
   * All numeric inputs must be finite and both flags must be booleans.
   * No kernels are needed; results retain CSPICE floating-point limits.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/azlrec_c.html
   */
  azlrec(
    range: number,
    az: number,
    el: number,
    azccw: boolean,
    elplsz: boolean,
  ): SpiceVector3;

  /**
   * Convert a rectangular vector to { range, az, el }.
   *
   * azccw=true measures azimuth from +X toward +Y; false measures clockwise.
   * elplsz=true measures elevation toward +Z; false toward -Z. Azimuth is
   * in [0, 2*pi] and elevation in [-pi/2, pi/2], in radians. On the Z axis
   * azimuth is zero; at the origin both angles are zero. Range uses the
   * input distance units. rect must contain exactly three finite numbers;
   * flags must be booleans. The input is not modified. No kernels are
   * needed; finite inputs can produce nonfinite range through overflow.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/recazl_c.html
   */
  recazl(
    rect: Readonly<SpiceVector3>,
    azccw: boolean,
    elplsz: boolean,
  ): { range: number; az: number; el: number };

  /**
   * Convert body-specific planetographic longitude, latitude and altitude
   * to a new rectangular vector using equatorial radius re and flattening f.
   *
   * Angles are radians; alt, re and the output use the same distance units.
   * Flattening is (re - polarRadius) / re. CSPICE requires re > 0 and f < 1;
   * negative flattening and altitude are allowed. Angles are not normalized.
   * Longitude is normally west-positive for prograde rotation and east-positive
   * for retrograde rotation; Earth, Moon and Sun default to east-positive.
   * `BODY<ID>_PGR_POSITIVE_LON` can override this with EAST or WEST. Without an
   * override, `BODY<ID>_PM` supplies the rotation rate; pinned N0067 requires
   * this data even for Moon and Sun, but not Earth. Current kernel-pool state
   * is used on each call. Unknown bodies, missing data, invalid overrides
   * and invalid spheroid parameters raise CSPICE errors.
   * body is a name or numeric ID string, passed unchanged; embedded NUL is
   * rejected. Numeric arguments must be finite. Numerical limits, including
   * nonfinite results from finite inputs, remain those of CSPICE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pgrrec_c.html
   */
  pgrrec(
    body: string,
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
  ): SpiceVector3;

  /**
   * Convert a rectangular vector to body-specific { lon, lat, alt }
   * using equatorial radius re and flattening f = (re - polarRadius) / re.
   *
   * Longitude is in [0, 2*pi] and latitude in [-pi/2, pi/2], in radians;
   * altitude and re use the vector's distance units. Longitude follows the
   * same body rotation and kernel-pool override conventions as pgrrec.
   * CSPICE requires re > 0 and f < 1; negative flattening is allowed. For
   * interior points where the nearest surface point is not unique, CSPICE's
   * choice is retained. Unknown bodies, missing rotation data, invalid
   * overrides and invalid spheroid parameters raise CSPICE errors.
   * body is an unchanged name or numeric ID string without embedded NUL.
   * rect must contain exactly three finite numbers, and re and f must be
   * finite. The input is not modified; a new object preserves all numerical
   * results, including nonfinite values at CSPICE's numerical limits.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/recpgr_c.html
   */
  recpgr(
    body: string,
    rect: Readonly<SpiceVector3>,
    re: number,
    f: number,
  ): { lon: number; lat: number; alt: number };

  /**
   * Convert range, right ascension and declination to a new rectangular vector.
   *
   * Angles are radians: right ascension increases from +X toward +Y, and
   * declination from the XY plane toward +Z. Negative range and angles outside
   * their usual ranges are passed through without normalization. Distance
   * units are preserved. All inputs must be finite. No kernels are needed;
   * results retain CSPICE floating-point limits.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/radrec_c.html
   */
  radrec(range: number, ra: number, dec: number): SpiceVector3;

  /**
   * Convert a rectangular vector to { range, ra, dec }.
   *
   * Right ascension ra increases from +X toward +Y in [0, 2*pi]; declination
   * dec is in [-pi/2, pi/2], in radians. On the Z axis ra is zero; at the
   * origin both angles are zero. Range uses the input distance units. rect
   * must contain exactly three finite numbers and is not modified. No
   * kernels are needed; finite inputs can produce nonfinite range through
   * overflow. The returned object is independent of the input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/recrad_c.html
   */
  recrad(rect: Readonly<SpiceVector3>): {
    range: number;
    ra: number;
    dec: number;
  };

  /**
   * Return a new rectangular point on a body's triaxial reference ellipsoid
   * at planetocentric longitude lon and latitude lat, in radians.
   *
   * Longitude increases from +X toward +Y independently of the body's spin;
   * latitude is measured from the XY plane toward +Z. Angles are passed
   * through without normalization. body must be a signed 32-bit integer ID.
   * Current kernel-pool `BODY<ID>_RADII` must supply three positive semiaxes;
   * missing or invalid radii raise CSPICE errors. Output units match those
   * radii (normally km). lon and lat must be finite; numerical limits remain
   * those of CSPICE, including possible nonfinite results. This is a
   * planetocentric surface conversion, not planetographic coordinates.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/srfrec_c.html
   */
  srfrec(body: number, lon: number, lat: number): SpiceVector3;

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
