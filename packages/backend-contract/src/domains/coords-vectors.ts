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

/** Scalar-first SPICE quaternion [w,x,y,z], distinct from a vector-first engineering quaternion. */
export type SpiceQuaternion = readonly [
  w: number,
  x: number,
  y: number,
  z: number,
];

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
   * Binary-search the supplied order and return the physical zero-based index of the matching entry.
   * An empty array or a missing key returns -1.
   * Supply a complete zero-based permutation of the values such that the indexed values are nondecreasing.
   * Each index must occur exactly once. The returned index addresses the original values.
   * When duplicates compare equal, CSPICE returns the first midpoint it probes that matches.
   * Comparison is case-sensitive and orders unsigned UTF-8 bytes, extending shorter strings with ASCII spaces.
   * Trailing spaces compare equal; tabs and other control bytes remain significant.
   * Well-formed strings and rows must be free of embedded NUL. The key and blank-padded, NUL-terminated rectangular table each fit in signed 32-bit byte counts.
   * The order length is at most 536,870,911 elements, keeping signed index and order-buffer byte counts representable.
   * WASM limits each buffer to 256 MiB. This search requires no kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bschoc_c.html
   */
  bschoc(
    key: string,
    values: readonly string[],
    order: readonly number[],
  ): number;

  /**
   * Binary-search the supplied order and return the physical zero-based index of the matching entry.
   * An empty array or a missing key returns -1.
   * Supply a complete zero-based permutation of the values such that the indexed values are nondecreasing.
   * Each index must occur exactly once. The returned index addresses the original values.
   * When duplicates compare equal, CSPICE returns the first midpoint it probes that matches.
   * The key and each value must be signed 32-bit integers.
   * The order length is at most 536,870,911 elements, keeping signed index and order-buffer byte counts representable.
   * WASM limits each buffer to 256 MiB. This search requires no kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bschoi_c.html
   */
  bschoi(
    key: number,
    values: readonly number[],
    order: readonly number[],
  ): number;

  /**
   * Binary-search the nondecreasing input and return the matching zero-based index.
   * An empty array or a missing key returns -1.
   * When duplicates compare equal, CSPICE returns the first midpoint it probes that matches.
   * Comparison is case-sensitive and orders unsigned UTF-8 bytes, extending shorter strings with ASCII spaces.
   * Trailing spaces compare equal; tabs and other control bytes remain significant.
   * Well-formed strings and rows must be free of embedded NUL. The key and blank-padded, NUL-terminated rectangular table each fit in signed 32-bit byte counts.
   * WASM limits each buffer to 256 MiB. This search requires no kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bsrchc_c.html
   */
  bsrchc(key: string, values: readonly string[]): number;

  /**
   * Binary-search the nondecreasing input and return the matching zero-based index.
   * An empty array or a missing key returns -1.
   * When duplicates compare equal, CSPICE returns the first midpoint it probes that matches.
   * IEEE equality matches signed zeros and infinities. NaN keys or elements fall outside this ordered search domain.
   * The element count is at most 1,073,741,823 to keep the one-based binary midpoint representable.
   * WASM limits each buffer to 256 MiB. This search requires no kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bsrchd_c.html
   */
  bsrchd(key: number, values: readonly number[]): number;

  /**
   * Binary-search the nondecreasing input and return the matching zero-based index.
   * An empty array or a missing key returns -1.
   * When duplicates compare equal, CSPICE returns the first midpoint it probes that matches.
   * The key and each value must be signed 32-bit integers.
   * The element count is at most 1,073,741,823 to keep the one-based binary midpoint representable.
   * WASM limits each buffer to 256 MiB. This search requires no kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bsrchi_c.html
   */
  bsrchi(key: number, values: readonly number[]): number;

  /**
   * Search the input in its supplied order and return the first matching zero-based index.
   * An empty array or a missing key returns -1.
   * Comparison is case-sensitive and orders unsigned UTF-8 bytes, extending shorter strings with ASCII spaces.
   * Trailing spaces compare equal; tabs and other control bytes remain significant.
   * Well-formed strings and rows must be free of embedded NUL. The key and blank-padded, NUL-terminated rectangular table each fit in signed 32-bit byte counts.
   * WASM limits each buffer to 256 MiB. This search requires no kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/isrchc_c.html
   */
  isrchc(key: string, values: readonly string[]): number;

  /**
   * Search the input in its supplied order and return the first matching zero-based index.
   * An empty array or a missing key returns -1.
   * IEEE equality matches signed zeros and infinities. NaN keys and elements never compare equal.
   * The element count is at most 2,147,483,646 to keep the inclusive loop increment representable.
   * WASM limits each buffer to 256 MiB. This search requires no kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/isrchd_c.html
   */
  isrchd(key: number, values: readonly number[]): number;

  /**
   * Search the input in its supplied order and return the first matching zero-based index.
   * An empty array or a missing key returns -1.
   * The key and each value must be signed 32-bit integers.
   * The element count is at most 2,147,483,646 to keep the inclusive loop increment representable.
   * WASM limits each buffer to 256 MiB. This search requires no kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/isrchi_c.html
   */
  isrchi(key: number, values: readonly number[]): number;

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

  /**
   * Differentiate (range, azimuth, elevation) with respect to (x, y, z). Positive azimuth is counterclockwise when azccw is true and clockwise otherwise. Positive elevation points toward +Z when elplsz is true and toward −Z otherwise. On the Z-axis CSPICE signals POINTONZAXIS.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dazldr_c.html
   */
  dazldr(
    x: number,
    y: number,
    z: number,
    azccw: boolean,
    elplsz: boolean,
  ): Mat3RowMajor;

  /**
   * Differentiate cylindrical (radius, longitude, z) with respect to (x, y, z). Longitude is in radians. On the Z-axis CSPICE signals POINTONZAXIS.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dcyldr_c.html
   */
  dcyldr(x: number, y: number, z: number): Mat3RowMajor;

  /**
   * Differentiate geodetic (longitude, latitude, altitude) with respect to (x, y, z). Supply the equatorial radius re in the coordinate distance unit and flattening f = (re − rp)/re. CSPICE requires re > 0 and f < 1, and the Z-axis is singular. The reference axes must admit finite N0067 nearest-point scaling.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dgeodr_c.html
   */
  dgeodr(x: number, y: number, z: number, re: number, f: number): Mat3RowMajor;

  /**
   * Differentiate latitudinal (radius, longitude, latitude) with respect to (x, y, z). Angles are in radians. On the Z-axis CSPICE signals POINTONZAXIS.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dlatdr_c.html
   */
  dlatdr(x: number, y: number, z: number): Mat3RowMajor;

  /**
   * Differentiate planetographic (longitude, latitude, altitude) with respect to (x, y, z). Supply re > 0 and f < 1. The Z-axis is singular. The reference axes must admit finite N0067 nearest-point scaling. `BODY<id>_PGR_POSITIVE_LON` can override the body spin convention. Without an override, Earth is east-positive; other bodies need a prime meridian rate, and the Sun and Moon use east-positive longitude after lookup. The paired body-name table must have hashable codes in N0067.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dpgrdr_c.html
   */
  dpgrdr(
    body: string,
    x: number,
    y: number,
    z: number,
    re: number,
    f: number,
  ): Mat3RowMajor;

  /**
   * Differentiate (x, y, z) with respect to (range, azimuth, elevation). True azccw chooses counterclockwise azimuth; true elplsz chooses elevation toward +Z. Angles are radians. Negative range signals VALUEOUTOFRANGE; zero range gives zero angular-derivative columns.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdazl_c.html
   */
  drdazl(
    range: number,
    az: number,
    el: number,
    azccw: boolean,
    elplsz: boolean,
  ): Mat3RowMajor;

  /**
   * Differentiate (x, y, z) with respect to cylindrical (radius, longitude, z). Longitude is in radians. Signed radii are evaluated directly; zero radius gives a zero longitude column.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdcyl_c.html
   */
  drdcyl(radius: number, lon: number, z: number): Mat3RowMajor;

  /**
   * Differentiate (x, y, z) with respect to geodetic (longitude, latitude, altitude). Angles are radians. Supply equatorial radius re > 0 in altitude units and flattening f = (re − rp)/re < 1, including negative flattening for a prolate body.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdgeo_c.html
   */
  drdgeo(
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
  ): Mat3RowMajor;

  /**
   * Differentiate (x, y, z) with respect to latitudinal (radius, longitude, latitude), with angles in radians. Signed radii are evaluated directly; angular-derivative columns vanish at zero radius.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdlat_c.html
   */
  drdlat(radius: number, lon: number, lat: number): Mat3RowMajor;

  /**
   * Differentiate (x, y, z) with respect to planetographic (longitude, latitude, altitude). Angles are radians. Equatorial radius re and altitude use the same unit, with re > 0 and f < 1. `BODY<id>_PGR_POSITIVE_LON` can override the body spin convention. Without an override, Earth is east-positive; other bodies need a prime meridian rate, and the Sun and Moon use east-positive longitude after lookup. The paired body-name table must have hashable codes in N0067.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdpgr_c.html
   */
  drdpgr(
    body: string,
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
  ): Mat3RowMajor;

  /**
   * Differentiate (x, y, z) with respect to spherical (radius, colatitude, longitude). Colatitude is measured from +Z in radians. Signed radii are evaluated directly; angular-derivative columns vanish at zero radius.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdsph_c.html
   */
  drdsph(radius: number, colat: number, lon: number): Mat3RowMajor;

  /**
   * Differentiate spherical (radius, colatitude, longitude) with respect to (x, y, z). Colatitude is measured from +Z in radians. On the Z-axis CSPICE signals POINTONZAXIS.
   * The owned row-major matrix has one row per output coordinate and one column per input coordinate. Finite inputs can produce nonfinite entries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dsphdr_c.html
   */
  dsphdr(x: number, y: number, z: number): Mat3RowMajor;

  /**
   * Copy an nr by nc flat row-major matrix. Negative dimensions are rejected because the
   * pinned implementation passes nr*nc to memmove. Inputs are finite flat row-major
   * arrays and outputs are owned. Dimensions must be nonnegative signed 32-bit integers.
   * Each input and output buffer on both backends is limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mequg_c.html
   */
  mequg(m1: readonly number[], nr: number, nc: number): number[];

  /**
   * Multiply transpose(m1) by m2. Inputs have nr1r2 rows and respectively nc1 and nc2
   * columns. A nonpositive contracted dimension yields a zero-filled nc1 by nc2 result
   * from empty operands. Inputs are finite flat row-major arrays and outputs are owned.
   * Signed 32-bit dimensions may be negative only for the contracted dimension. Each
   * input and output buffer on both backends is limited to 256 MiB. The outer output row
   * count is also limited to 33,554,432, including when the result has zero columns.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mtxmg_c.html
   */
  mtxmg(
    m1: readonly number[],
    m2: readonly number[],
    nc1: number,
    nr1r2: number,
    nc2: number,
  ): number[];

  /**
   * Multiply transpose(m1) by v2. The matrix has nr1r2 rows and nc1 columns, and the
   * vector has nr1r2 entries. Supply magnitudes that avoid intermediate overflow. Inputs
   * are finite flat row-major arrays and outputs are owned. Dimensions must be
   * nonnegative signed 32-bit integers. Each input and output buffer on both backends is
   * limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mtxvg_c.html
   */
  mtxvg(
    m1: readonly number[],
    v2: readonly number[],
    nc1: number,
    nr1r2: number,
  ): number[];

  /**
   * Multiply m1 by m2. Inputs have shapes nr1 by nc1r2 and nc1r2 by nc2. A nonpositive
   * contracted dimension yields a zero-filled nr1 by nc2 result from empty operands.
   * Inputs are finite flat row-major arrays and outputs are owned. Signed 32-bit
   * dimensions may be negative only for the contracted dimension. Each input and output
   * buffer on both backends is limited to 256 MiB. The outer output row count is also
   * limited to 33,554,432, including when the result has zero columns.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mxmg_c.html
   */
  mxmg(
    m1: readonly number[],
    m2: readonly number[],
    nr1: number,
    nc1r2: number,
    nc2: number,
  ): number[];

  /**
   * Multiply m1 by transpose(m2). Both input matrices have nc1c2 columns, with nr1 and
   * nr2 rows respectively. Supply magnitudes that avoid intermediate overflow. Inputs are
   * finite flat row-major arrays and outputs are owned. Dimensions must be nonnegative
   * signed 32-bit integers. Each input and output buffer on both backends is limited to
   * 256 MiB. The outer output row count is also limited to 33,554,432, including when the
   * result has zero columns.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mxmtg_c.html
   */
  mxmtg(
    m1: readonly number[],
    m2: readonly number[],
    nr1: number,
    nc1c2: number,
    nr2: number,
  ): number[];

  /**
   * Multiply an nr1 by nc1r2 matrix by an nc1r2-element vector. The result has nr1
   * entries. Supply magnitudes that avoid intermediate overflow. Inputs are finite flat
   * row-major arrays and outputs are owned. Dimensions must be nonnegative signed 32-bit
   * integers. Each input and output buffer on both backends is limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mxvg_c.html
   */
  mxvg(
    m1: readonly number[],
    v2: readonly number[],
    nr1: number,
    nc1r2: number,
  ): number[];

  /**
   * Compute the scalar transpose(v1) * matrix * v2. The vectors have nrow and ncol
   * entries. An empty contraction returns zero. Choose magnitudes that keep intermediate
   * products and sums in range. Inputs are finite flat row-major arrays and outputs are
   * owned. Dimensions must be nonnegative signed 32-bit integers. Each input and output
   * buffer on both backends is limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vtmvg_c.html
   */
  vtmvg(
    v1: readonly number[],
    matrix: readonly number[],
    v2: readonly number[],
    nrow: number,
    ncol: number,
  ): number;

  /**
   * Transpose an nrow by ncol matrix into a separate flat ncol by nrow output. When
   * either dimension is nonpositive, the actual routine takes no action on the empty
   * input/output. Inputs are finite flat row-major arrays and outputs are owned.
   * Dimensions are signed 32-bit integers. Each input and output buffer on both backends
   * is limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/xposeg_c.html
   */
  xposeg(matrix: readonly number[], nrow: number, ncol: number): number[];

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

  /** Return a unit axis and angle in radians in [0,pi] for a row-major rotation. Identity returns [0,0,1] and zero; at pi the sign of the axis is not uniquely determined. Invalid rotations can signal an error. Inputs must be finite; outputs are owned. No kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/raxisa_c.html
   */
  raxisa(m: Mat3RowMajor): { axis: SpiceVector3; angle: number };
  /** Return angular velocity in radians per unit of derivative time. CSPICE normalizes q and applies -2 times the vector part of conjugate(qhat) times dq. The derivative is not normalized; a zero q yields zero for ordinary finite derivatives. Inputs must be finite; outputs are owned. No kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/qdq2av_c.html
   */
  qdq2av(q: SpiceQuaternion, dq: SpiceQuaternion): SpiceVector3;
  /** Return the Hamilton product q1 times q2. Order matters. Inputs are scalar-first SPICE quaternions; they need not have unit length. No normalization is applied. Inputs must be finite; outputs are owned. No kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/qxq_c.html
   */
  qxq(q1: SpiceQuaternion, q2: SpiceQuaternion): SpiceQuaternion;
  /** Convert a scalar-first SPICE quaternion to a row-major rotation matrix. Normalization is implicit; zero gives identity. N0067 forms products before normalization, so finite extreme components may yield identity or nonfinite entries. Inputs must be finite; outputs are owned. No kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/q2m_c.html
   */
  q2m(q: SpiceQuaternion): Mat3RowMajor;
  /** Return a unit SPICE quaternion (scalar component first) for a row-major rotation; the scalar component is nonnegative. A rejected rotation signals NOTAROTATION. Inputs must be finite; outputs are owned. No kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/m2q_c.html
   */
  m2q(m: Mat3RowMajor): SpiceQuaternion;
  /** Decompose a row-major rotation matrix into angles in radians. Middle axis must differ from both neighbors. When the end angles are nonunique CSPICE sets angle3 to zero. Invalid axis sequences or a rejected rotation signal CSPICE errors. Inputs must be finite; outputs are owned. No kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/m2eul_c.html
   */
  m2eul(
    m: Mat3RowMajor,
    axis3: number,
    axis2: number,
    axis1: number,
  ): { angle3: number; angle2: number; angle1: number };
  /** Compose the three coordinate-axis rotations in the stated 3,2,1 argument order. Angles are radians, axes are 1,2,3. Repeated axes are allowed; an out-of-range axis signals BADAXISNUMBERS. Inputs must be finite; outputs are owned. No kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/eul2m_c.html
   */
  eul2m(
    angle3: number,
    angle2: number,
    angle1: number,
    axis3: number,
    axis2: number,
    axis1: number,
  ): Mat3RowMajor;
  /**
   * Return the determinant of a finite 3x3 matrix in row-major order.
   *
   * CSPICE evaluates the determinant directly. Overflow, underflow and
   * cancellation retain its floating-point behavior, including nonfinite
   * results. The input is unchanged. No kernels are needed. CSPICE is
   * error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/det_c.html
   */
  det(m: Mat3RowMajor): number;

  /**
   * Diagonalize a symmetric 2x2 matrix, returning independent diag and rotate matrices.
   *
   * Input and outputs use flat row-major order [m00, m01, m10, m11]. All input
   * entries must be finite. CSPICE uses only m00, m01 and m11; m10 is ignored,
   * so differing off-diagonal entries are accepted without symmetrization.
   * For the symmetric matrix represented by those upper-triangular entries,
   * diag = transpose(rotate) * symmat * rotate. The columns of rotate are
   * eigenvectors; CSPICE chooses a rotation of smallest absolute angle.
   * Eigenvalues are not sorted and signs are not canonicalized; tied choices
   * retain CSPICE's selection. A diagonal input retains its diagonal order
   * and gives identity rotate. Zero or negative eigenvalues are allowed.
   * Numerical limits, including nonfinite results, remain those of CSPICE.
   * No kernels are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/diags2_c.html
   */
  diags2(symmat: readonly [number, number, number, number]): {
    diag: [number, number, number, number];
    rotate: [number, number, number, number];
  };

  /**
   * Return an independent 3x3 identity matrix in row-major order.
   *
   * No kernels are needed. This calls CSPICE's error-free ident_c routine.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ident_c.html
   */
  ident(): Mat3RowMajor;

  /**
   * Return the inverse of a finite 3x3 row-major matrix as an independent matrix.
   *
   * Pinned CSPICE N0067 returns an all-zero matrix when abs(det(m)) < 1e-16;
   * this is a strict threshold, not a SPICE error. Otherwise it evaluates
   * cofactors and divides by the determinant. Inputs should keep these
   * intermediate products within floating-point range. Overflow, underflow
   * and cancellation are not corrected, and nonfinite outputs are retained.
   * No kernels are needed. Invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/invert_c.html
   */
  invert(m: Mat3RowMajor): Mat3RowMajor;

  /**
   * Transpose a finite 3x3 matrix and divide each output row by its squared norm.
   *
   * The result is an inverse when the input columns are orthogonal and
   * nonzero; CSPICE does not validate orthogonality. Inputs and the independent
   * output use row-major order. A zero-length column throws
   * SPICE(ZEROLENGTHCOLUMN); a column whose norm is too small to reciprocate
   * throws SPICE(COLUMNTOOSMALL). Other numerical limits retain CSPICE behavior.
   * No kernels are needed. Invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/invort_c.html
   */
  invort(m: Mat3RowMajor): Mat3RowMajor;

  /**
   * Test a finite 3x3 row-major matrix using CSPICE's rotation criteria.
   *
   * Column norms must be in [1 - ntol, 1 + ntol]. The determinant of the
   * matrix with unitized columns must be in [1 - dtol, 1 + dtol]. Bounds
   * are inclusive; this is a tolerance test, not an exact orthogonality test.
   * Both tolerances must be finite. Negative tolerances reach CSPICE and
   * throw SPICE(VALUEOUTOFRANGE); zero tolerances are allowed. No kernels
   * are needed. Invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/isrot_c.html
   */
  isrot(m: Mat3RowMajor, ntol: number, dtol: number): boolean;

  /**
   * Return an independent row-major copy of a finite 3x3 matrix.
   *
   * Component order and signed zeros are retained. No kernels are needed.
   * CSPICE is error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mequ_c.html
   */
  mequ(m: Mat3RowMajor): Mat3RowMajor;

  /**
   * Return transpose(a) * b as an independent 3x3 row-major matrix.
   *
   * Both input matrices contain exactly nine finite numbers in row-major
   * order and are unchanged. Keep intermediate products within range for
   * meaningful results; CSPICE overflow, underflow and cancellation are
   * preserved, including nonfinite outputs. No kernels are needed. CSPICE
   * is error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mtxm_c.html
   */
  mtxm(a: Mat3RowMajor, b: Mat3RowMajor): Mat3RowMajor;

  /**
   * Return a * transpose(b) as an independent 3x3 row-major matrix.
   *
   * Both input matrices contain exactly nine finite numbers in row-major
   * order and are unchanged. Keep intermediate products within range for
   * meaningful results; CSPICE overflow, underflow and cancellation are
   * preserved, including nonfinite outputs. No kernels are needed. CSPICE
   * is error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mxmt_c.html
   */
  mxmt(a: Mat3RowMajor, b: Mat3RowMajor): Mat3RowMajor;

  /**
   * Return the sum of the diagonal entries of a finite 3x3 row-major matrix.
   *
   * The input is unchanged. Summation retains CSPICE floating-point behavior,
   * including overflow and cancellation. No kernels are needed. CSPICE is
   * error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/trace_c.html
   */
  trace(m: Mat3RowMajor): number;

  /**
   * Return the transpose of a finite 3x3 matrix as an independent row-major matrix.
   *
   * The input is unchanged and every component, including signed zero, is
   * retained in transposed position. No kernels are needed. CSPICE is
   * error-free; invalid JavaScript matrix inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/xpose_c.html
   */
  xpose(m: Mat3RowMajor): Mat3RowMajor;

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

  /**
   * Evaluate an equally spaced Hermite interpolating polynomial at x.
   *
   * For point first + i * step, yvals[2*i] is the function value and
   * yvals[2*i+1] its first derivative with respect to the abscissa.
   * yvals must have even length; n = yvals.length / 2. Return { f, df },
   * the polynomial value and derivative at x. Negative step is allowed;
   * zero step signals CSPICE(INVALIDSTEPSIZE). No points signals
   * CSPICE(INVALIDSIZE). The maximum n is 67108863, keeping the pinned
   * CSPICE wrapper's internal 32*n workspace byte count within signed32.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/hrmesp_c.html
   */
  hrmesp(
    first: number,
    step: number,
    yvals: readonly number[],
    x: number,
  ): { f: number; df: number };

  /**
   * Evaluate a Hermite interpolating polynomial at x.
   *
   * xvals contains the abscissae; yvals must have exactly twice as many
   * entries, interleaving function value and first derivative for each
   * point. Return { f, df }, the value and derivative with respect to the
   * abscissa. Input order is preserved. Duplicate abscissae signal
   * CSPICE(DIVIDEBYZERO); no points signals CSPICE(INVALIDSIZE).
   * The maximum point count is 357913941, keeping the pinned translated
   * routine's intermediate 6*n-1 workspace index within signed32.
   * The internal workspace contains 4*n doubles.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/hrmint_c.html
   */
  hrmint(
    xvals: readonly number[],
    yvals: readonly number[],
    x: number,
  ): { f: number; df: number };

  /**
   * Evaluate a Lagrange polynomial on equally spaced points at x.
   *
   * yvals[i] is the function value at first + i * step. The inferred point
   * count is yvals.length. Negative step is allowed; zero step signals
   * CSPICE(INVALIDSTEPSIZE). No points signals CSPICE(INVALIDSIZE).
   * The maximum point count is 268435455, keeping the pinned wrapper's
   * internal 8*n workspace byte count within signed32.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgresp_c.html
   */
  lgresp(
    first: number,
    step: number,
    yvals: readonly number[],
    x: number,
  ): number;

  /**
   * Evaluate a Lagrange polynomial and its derivative at x.
   *
   * xvals and yvals must have equal lengths and give corresponding
   * abscissae and values. Return { p, dp }, the value and derivative with
   * respect to the abscissa. NAIF specifies distinct, increasing xvals;
   * this raw wrapper preserves input order without sorting or deduplication.
   * Duplicates signal CSPICE(DIVIDEBYZERO); no points signals
   * CSPICE(INVALIDSIZE). The maximum point count is 715827882, keeping the
   * pinned translated routine's intermediate 3*n index within signed32.
   * The internal workspace contains 2*n doubles.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgrind_c.html
   */
  lgrind(
    xvals: readonly number[],
    yvals: readonly number[],
    x: number,
  ): { p: number; dp: number };

  /**
   * Evaluate a Lagrange interpolating polynomial at x.
   *
   * xvals and yvals must have equal lengths and give corresponding
   * abscissae and values. NAIF specifies distinct, increasing xvals;
   * this raw wrapper preserves input order without sorting or deduplication.
   * Duplicates signal CSPICE(DIVIDEBYZERO); no points signals
   * CSPICE(INVALIDSIZE). The maximum point count is 268435455, keeping the
   * pinned wrapper's internal 8*n workspace byte count within signed32.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgrint_c.html
   */
  lgrint(xvals: readonly number[], yvals: readonly number[], x: number): number;

  /**
   * Estimate a vector function's derivative at the midpoint of two samples.
   *
   * f0 and f2 contain function values at abscissae separated by 2*delta.
   * They must have equal, nonzero lengths. delta may be negative; zero
   * signals CSPICE(DIVIDEBYZERO). Return an independent array containing
   * the actual CSPICE derivative estimates. The pinned routine forms
   * (0.5/delta)*f2 + (-0.5/delta)*f0; its overflow, underflow and cancellation
   * behavior can differ from subtracting first and dividing afterwards.
   * Empty vectors are rejected because NAIF does not define a portable
   * zero-dimensional call. The maximum dimension is 2147483646 to avoid
   * overflow of the pinned translated routine's inclusive loop counter.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/qderiv_c.html
   */
  qderiv(f0: readonly number[], f2: readonly number[], delta: number): number[];

  /**
   * Evaluate a Chebyshev expansion and its first nderiv derivatives at x.
   *
   * cp[i] multiplies the first-kind Chebyshev polynomial T_i(s), with
   * s = (x - x2s[0]) / x2s[1]; degree is cp.length - 1. cp must be nonempty.
   * The independent result array has nderiv + 1 entries, starting with the
   * value, followed by derivatives with respect to x (not s). nderiv must
   * be an integer in [0, 715827881], keeping the pinned toolkit's workspace
   * indices within signed32. Workspace is allocated internally.
   *
   * For reliable evaluation, use a nonzero transformation scale x2s[1]
   * and normalized s in [-1, 1]. Inputs are not clamped: negative scales,
   * zero scales and extrapolation reach CSPICE unchanged. Zero scales do
   * not define a valid normalization; extrapolation and high derivative
   * orders can cause severe numerical error or overflow.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbder_c.html
   */
  chbder(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
    nderiv: number,
  ): number[];

  /**
   * Evaluate a Chebyshev expansion and its integral at x.
   *
   * cp[i] multiplies T_i(s), where s = (x - x2s[0]) / x2s[1]; degree is
   * cp.length - 1. Return { p, itgrlp }, where p is the expansion value and
   * itgrlp is its integral with respect to x, chosen to be zero at x2s[0].
   * An empty cp reaches CSPICE as degree -1 and signals INVALIDDEGREE.
   * A nonpositive x2s[1] signals INVALIDRADIUS; these are CSPICE errors.
   * For reliable evaluation use normalized s in [-1, 1]. No clamping or
   * overflow checks are performed; large degree can accumulate roundoff.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbigr_c.html
   */
  chbigr(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): { p: number; itgrlp: number };

  /**
   * Evaluate a Chebyshev expansion and its first derivative at x.
   *
   * cp[i] multiplies T_i(s), with s = (x - x2s[0]) / x2s[1]; degree is
   * cp.length - 1. cp must be nonempty. Return { p, dpdx }, preserving the
   * value and derivative with respect to x (not s).
   * Use a nonzero scale x2s[1] and normalized s in [-1, 1] for reliable
   * evaluation. Finite scales and abscissae reach CSPICE unchanged; a zero
   * scale is not a valid normalization and extrapolation can overflow.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbint_c.html
   */
  chbint(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): { p: number; dpdx: number };

  /**
   * Evaluate a Chebyshev expansion at x.
   *
   * cp[i] multiplies T_i(s), with s = (x - x2s[0]) / x2s[1]; degree is
   * cp.length - 1. cp must be nonempty. Use a nonzero scale x2s[1] and
   * normalized s in [-1, 1] for reliable evaluation. Finite scales and
   * abscissae reach CSPICE unchanged; a zero scale is not a valid
   * normalization and extrapolation can overflow.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbval_c.html
   */
  chbval(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): number;

  /**
   * Evaluate an ordinary polynomial and its first nderiv derivatives at t.
   *
   * coeffs[i] is the coefficient of t^i; degree is coeffs.length - 1.
   * Return an independent array starting with the polynomial value,
   * followed by successive derivatives. Empty coefficients imply degree
   * -1 and yield nderiv + 1 zeros when nderiv is nonnegative. A negative
   * signed32 nderiv invokes CSPICE's no-write path and returns [].
   * Nonnegative nderiv must be at most 2147483646 to keep the pinned
   * translated loop counter within signed32. High derivative orders can
   * grow rapidly and overflow; results are not replaced or normalized.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/polyds_c.html
   */
  polyds(coeffs: readonly number[], nderiv: number, t: number): number[];

  /**
   * Return both roots of a*x^2 + b*x + c = 0 as complex pairs.
   *
   * Return { root1, root2 }, each an independent [real, imaginary] array.
   * For a nonzero quadratic coefficient, root1 corresponds to the positive
   * square-root term in the quadratic formula and root2 to the negative
   * term; this does not sort roots or guarantee positive root1 imaginary
   * part when a is negative. A linear equation (a = 0, b != 0) returns the
   * same root in both arrays. If a and b are both zero, CSPICE signals
   * DEGENERATECASE. The pinned toolkit's degenerate-case path may also write
   * a NAMESDONOTMATCH trace diagnostic; the raised CSPICE error remains
   * DEGENERATECASE. CSPICE scales coefficients when possible but does not
   * check root overflow; all numerical outputs are retained.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rquad_c.html
   */
  rquad(
    a: number,
    b: number,
    c: number,
  ): { root1: [number, number]; root2: [number, number] };

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
