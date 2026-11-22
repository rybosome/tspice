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
