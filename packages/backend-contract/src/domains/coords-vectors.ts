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
   * Test whether the signed integer entries are exactly the indices 0 through n−1 in any order. Empty input is false. Duplicates and out-of-range indices are false, including both signed integer extremes. Array arguments are read once and returned arrays are owned copies.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/isordv_c.html
   */
  isordv(order: readonly number[]): boolean;
  /**
   * Return zero-based source indices in case-sensitive, ascending blank-padded UTF-8 byte order. Trailing ASCII blanks compare equal. The Shell-sort permutation of ties can be unstable. Array arguments are read once and returned arrays are owned copies. Text must be well-formed UTF-8 without embedded NUL.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/orderc_c.html
   */
  orderc(values: readonly string[]): number[];
  /**
   * Return zero-based source indices from the toolkit’s ascending Shell sort of IEEE doubles. Equal keys may change relative order. NaNs have no numerical ordering; their permutation follows the pinned comparison sequence. Array arguments are read once and returned arrays are owned copies.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/orderd_c.html
   */
  orderd(values: readonly number[]): number[];
  /**
   * Return zero-based source indices from the ascending Shell sort of signed 32-bit integers. Equal keys may change relative order. Array arguments are read once and returned arrays are owned copies.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/orderi_c.html
   */
  orderi(values: readonly number[]): number[];
  /**
   * Return strings in the specified source-index order. Exact C string contents are preserved, including trailing blanks, tabs, empty strings and UTF-8. Require a full zero-based permutation. Output entry i comes from input order[i]. Array arguments are read once and returned arrays are owned copies. Text must be well-formed UTF-8 without embedded NUL.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/reordc_c.html
   */
  reordc(order: readonly number[], values: readonly string[]): string[];
  /**
   * Return IEEE doubles in the specified source-index order, preserving infinities, NaNs and signed zero. Require a full zero-based permutation. Output entry i comes from input order[i]. Array arguments are read once and returned arrays are owned copies.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/reordd_c.html
   */
  reordd(order: readonly number[], values: readonly number[]): number[];
  /**
   * Return signed 32-bit integers in the specified source-index order. Require a full zero-based permutation. Output entry i comes from input order[i]. Array arguments are read once and returned arrays are owned copies.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/reordi_c.html
   */
  reordi(order: readonly number[], values: readonly number[]): number[];
  /**
   * Return boolean values in the specified source-index order. Each input must be true or false. Require a full zero-based permutation. Output entry i comes from input order[i]. Array arguments are read once and returned arrays are owned copies.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/reordl_c.html
   */
  reordl(order: readonly number[], values: readonly boolean[]): boolean[];
  /**
   * Return the toolkit’s ascending Shell sort of case-sensitive, blank-padded UTF-8 strings. For two or more entries CSPICE strips trailing ASCII spaces on copyout; a single string is returned intact. Tabs and BOM are preserved. Array arguments are read once and returned arrays are owned copies. Text must be well-formed UTF-8 without embedded NUL.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/shellc_c.html
   */
  shellc(values: readonly string[]): string[];
  /**
   * Return the toolkit’s ascending Shell sort of IEEE doubles. Equal keys can exchange positions. NaNs lack a numerical ordering; the returned sequence preserves the canonical comparisons. Array arguments are read once and returned arrays are owned copies.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/shelld_c.html
   */
  shelld(values: readonly number[]): number[];
  /**
   * Return the ascending Shell sort of signed 32-bit integers, including duplicates and extrema. Array arguments are read once and returned arrays are owned copies.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/shelli_c.html
   */
  shelli(values: readonly number[]): number[];
  /**
   * Return the zero-based index of the last element less than or equal to key.
   * An empty array or the absence of a qualifying value returns -1. Equality includes the last duplicate.
   *
   * The caller supplies values in nondecreasing, case-sensitive byte order.
   * CSPICE compares unsigned bytes and extends shorter strings with ASCII
   * spaces. Trailing spaces compare equal. Control bytes, including tabs,
   * retain their byte ordering. Empty keys and rows are supported.
   * Well-formed UTF-16 inputs are encoded as UTF-8. Embedded NUL is invalid.
   * A row has max(2, longest encoded row length + 1) bytes, with ASCII
   * spaces after the text and a final NUL. The table and the terminated key
   * each fit in signed 32-bit byte counts.
   * Input order is preserved. WASM limits each buffer to 256 MiB. No kernels
   * are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lstlec_c.html
   */
  lstlec(key: string, values: readonly string[]): number;

  /**
   * Return the zero-based index of the last element less than or equal to key.
   * An empty array or the absence of a qualifying value returns -1. Equality includes the last duplicate.
   *
   * The caller supplies values in nondecreasing numerical order. The key and
   * entries are doubles. Infinities are ordered, positive and negative zero
   * compare equal, and NaN is rejected because it is unordered. Array length
   * is limited to 2147483647 elements.
   * Input order is preserved. WASM limits each buffer to 256 MiB. No kernels
   * are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lstled_c.html
   */
  lstled(key: number, values: readonly number[]): number;

  /**
   * Return the zero-based index of the last element less than or equal to key.
   * An empty array or the absence of a qualifying value returns -1. Equality includes the last duplicate.
   *
   * The caller supplies values in nondecreasing numerical order. The key and
   * entries must be signed 32-bit integers. Array length
   * is limited to 2147483647 elements.
   * Input order is preserved. WASM limits each buffer to 256 MiB. No kernels
   * are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lstlei_c.html
   */
  lstlei(key: number, values: readonly number[]): number;

  /**
   * Return the zero-based index of the last element strictly less than key.
   * An empty array or the absence of a qualifying value returns -1. Equal values are skipped.
   *
   * The caller supplies values in nondecreasing, case-sensitive byte order.
   * CSPICE compares unsigned bytes and extends shorter strings with ASCII
   * spaces. Trailing spaces compare equal. Control bytes, including tabs,
   * retain their byte ordering. Empty keys and rows are supported.
   * Well-formed UTF-16 inputs are encoded as UTF-8. Embedded NUL is invalid.
   * A row has max(2, longest encoded row length + 1) bytes, with ASCII
   * spaces after the text and a final NUL. The table and the terminated key
   * each fit in signed 32-bit byte counts.
   * Input order is preserved. WASM limits each buffer to 256 MiB. No kernels
   * are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lstltc_c.html
   */
  lstltc(key: string, values: readonly string[]): number;

  /**
   * Return the zero-based index of the last element strictly less than key.
   * An empty array or the absence of a qualifying value returns -1. Equal values are skipped.
   *
   * The caller supplies values in nondecreasing numerical order. The key and
   * entries are doubles. Infinities are ordered, positive and negative zero
   * compare equal, and NaN is rejected because it is unordered. Array length
   * is limited to 2147483647 elements.
   * Input order is preserved. WASM limits each buffer to 256 MiB. No kernels
   * are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lstltd_c.html
   */
  lstltd(key: number, values: readonly number[]): number;

  /**
   * Return the zero-based index of the last element strictly less than key.
   * An empty array or the absence of a qualifying value returns -1. Equal values are skipped.
   *
   * The caller supplies values in nondecreasing numerical order. The key and
   * entries must be signed 32-bit integers. Array length
   * is limited to 2147483647 elements.
   * Input order is preserved. WASM limits each buffer to 256 MiB. No kernels
   * are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lstlti_c.html
   */
  lstlti(key: number, values: readonly number[]): number;

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
