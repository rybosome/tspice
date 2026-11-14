/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
export interface TimeKitApi {
  /** Return the underlying SPICE toolkit version string. */
  spiceVersion(): string;
}

/** Time-domain backend API surface over SPICE primitives. */
export interface TimeApi {
  /**
   * Thin wrapper over the SPICE primitive `tkvrsn()`.
   *
   * Only TOOLKIT is exposed; other items are rejected by this contract. The
   * version is immutable for a loaded toolkit: WASM obtains it from CSPICE once
   * during module initialization and returns that cached value.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/tkvrsn_c.html
   */
  tkvrsn(item: "TOOLKIT"): string;

  // --- core conversions ----------------------------------------------------

  /**
   * Parse a time string to TDB/ET seconds past J2000 (2000 JAN 1 12:00 TDB).
   * UTC conversion requires leap-second information; explicit labels and TIMDEF
   * defaults determine system/calendar/zone. Invalid strings signal CSPICE errors.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/str2et_c.html
   */
  str2et(time: string): number;

  /**
   * Format ET/TDB seconds past J2000 as UTC using an LSK. Formats C, D, J,
   * ISOC and ISOD select calendar, ordinal or Julian-day output. Signed SpiceInt
   * precision is clamped by CSPICE to [0,14]; fractional values are invalid.
   * Calendar formats include era text when needed; ISO before 1 AD signals
   * YEAROUTOFRANGE. Unknown format signals INVALIDTIMEFORMAT.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/et2utc_c.html
   */
  et2utc(et: number, format: string, prec: number): string;

  /**
   * Format an ephemeris time using a NAIF time picture.
   *
   * `et` is TDB seconds past J2000; nonempty `picture` selects fields, precision,
   * system and zone directives. Default system/calendar/zone follow TIMDEF.
   * Leap-second information is required for conversion. CSPICE applies its own
   * internal formatting limits; the actual rendered string is returned.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/timout_c.html
   */
  timout(et: number, picture: string): string;

  /**
   * Return the difference ET - UTC at a given epoch.
   *
   * Kernel prerequisites:
   * - Requires an LSK (leapseconds) kernel to be loaded.
   *
   * Epoch is formal UTC or ET seconds past J2000 according to eptype; the
   * result is ET minus UTC in seconds, including the epoch-dependent leap step.
   * This contract accepts uppercase ET/UTC selectors only on both backends.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/deltet_c.html
   */
  deltet(epoch: number, eptype: "ET" | "UTC"): number;

  /**
   * Convert a time epoch from one system to another.
   *
   * Kernel prerequisites:
   * - Requires an LSK (leapseconds) kernel to be loaded.
   *
   * Epoch units follow the system: ET/TDB, TAI and TDT/TT use seconds past
   * J2000, while JED/JDTDB/JDTDT use Julian days. Unsupported system names signal
   * SPICE(BADTIMETYPE); missing conversion constants signal MISSINGTIMEINFO.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/unitim_c.html
   */
  unitim(epoch: number, insys: string, outsys: string): number;

  // --- parsing + formatting ------------------------------------------------

  /**
   * Parse a UTC time string to **UTC seconds past J2000**.
   *
   * This uses SPICE's "formal calendar" (fixed 86400-second days) and does **not**
   * account for leap seconds.
   *
   * Limitations:
   * - UTC-only: `timstr` must not include time system labels (e.g. `TDB`) or
   *   time zone designators/offsets (e.g. `PDT`, `UTC+05:00`).
   *
   * Kernel prerequisites:
   * - None.
   *
   * TPARSE diagnostic text is translated to a thrown error even when CSPICE's
   * global failed flag is false; no epoch is returned on a parse failure.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/tparse_c.html
   */
  tparse(timstr: string): number;

  /**
   * Derive a NAIF formatting picture from a nonempty sample time string.
   * `pictur` is a nonempty initial output-template argument retained by this API;
   * derivation is sample-driven and its length does not limit the output.
   *
   * Statefulness: this is affected by TIMDEF defaults (SYSTEM/CALENDAR/ZONE),
   * since `sample` is interpreted under the current TIMDEF state.
   *
   * Kernel prerequisites:
   * - None.
   *
   * An unrecognized sample produces a thrown diagnostic from CSPICE ok/errmsg,
   * even when no global SPICE failure is signaled.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/tpictr_c.html
   */
  tpictr(sample: string, pictur: string): string;

  /**
   * Get or set time conversion defaults.
   *
   * Kernel prerequisites:
   * - None.
   *
   * Items include SYSTEM, CALENDAR and ZONE. SYSTEM/ZONE are mutually exclusive;
   * setting one clears the other. Defaults persist across kclear/reset until set
   * explicitly again; callers own restoration after temporary changes.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/timdef_c.html
   */
  timdef(action: "GET", item: string): string;
  /** Set a time conversion default (see `timdef_c`). */
  timdef(action: "SET", item: string, value: string): void;

  // --- SCLK conversions + CK attitude -------------------------------------

  /**
   * Convert a formatted, optionally partitioned SCLK string to ET seconds past
   * J2000 for a signed 32-bit spacecraft ID. Requires its clock kernel and, when
   * the clock time system is not TDB, LSK conversion information.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/scs2e_c.html
   */
  scs2e(sc: number, sclkch: string): number;

  /**
   * Convert finite ET seconds past J2000 to partition-aware spacecraft
   * clock ticks rounded to a whole tick. The pinned type-1 algorithm rounds
   * half ticks away from zero and checks the rounded count against the clock
   * range. Load the spacecraft clock kernel and time-system conversion data
   * required by that clock. The result is a CSPICE double.
   *
   * The backend uses N0067's linked SPICELIB SCE2T implementation with
   * initialized output and the C wrapper's trace frame. The pinned C wrapper
   * otherwise copies its own uninitialized temporary on early errors.
   *
   * sc is a signed 32-bit spacecraft ID except -2147483648, since the
   * pinned clock routines negate it to construct kernel variable names.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sce2t_c.html
   */
  sce2t(sc: number, et: number): number;

  /**
   * Format finite raw clock ticks using the spacecraft's type-1 field
   * moduli, offsets, widths and output delimiter. The string omits the
   * partition number. Fractional ticks round to nearest, with half ticks
   * away from zero. A rounded negative count signals SPICE(VALUEOUTOFRANGE).
   *
   * clklen includes the NUL terminator and defaults to 2048 bytes. A signed
   * capacity below two signals SPICE(STRINGTOOSHORT). A capacity that cannot
   * hold the nominal field widths signals SPICE(SCLKTRUNCATED). A field
   * exceeding its nominal width can instead be truncated by CSPICE's final
   * string assignment. Values above 3100 use 3100 physical bytes, sufficient
   * for all ten possible finite-double nominal widths and delimiters.
   *
   * N0067 uses a 30-byte numeric scratch field. Unsafe field-width logarithms,
   * nonfinite modulus products, or potential component magnitudes reaching
   * 10^28 (including a 14-significant-digit rounding margin) are rejected
   * before formatting. The multi-field guard also excludes the final floating-
   * point rounding margin below DBL_MAX for the translated remainder operation.
   * These checks use conservative magnitude bounds and may reject unusual
   * clock definitions for which a particular formatted component would fit.
   * They inspect available type-1 field data even when the nominal clock
   * type differs, because a partition read can populate N0067's clock cache.
   *
   * sc is a signed 32-bit spacecraft ID except -2147483648, since the
   * pinned clock routines negate it to construct kernel variable names.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/scfmt_c.html
   */
  scfmt(sc: number, ticks: number, clklen?: number): string;

  /**
   * Read the spacecraft's clock partitions in kernel order. Return fresh
   * pstart and pstop arrays of equal length. At index i they contain the
   * inclusive raw starting and stopping ticks of partition i+1. The numbers
   * are the clock kernel's partition values, before cumulative partition
   * offsets. Read the count from pstart.length.
   *
   * Both physical output buffers hold SPICE_SCLK_MXPART (9999) doubles, as
   * required by N0067's room-less API. Only the returned entries are copied.
   * Missing kernel variables and inconsistent start/stop counts reach CSPICE.
   *
   * sc is a signed 32-bit spacecraft ID except -2147483648, since the
   * pinned clock routines negate it to construct kernel variable names.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/scpart_c.html
   */
  scpart(sc: number): { pstart: number[]; pstop: number[] };

  /**
   * Convert a clock string to raw double-precision ticks relative to the
   * start of the spacecraft's clock. Supply the clock fields without a
   * partition prefix. Type-1 parsing accepts the clock delimiters and applies
   * field offsets. Missing trailing fields default to their minimum values.
   * A numeric field can exceed its usual modulus, and trailing zeros in a
   * field are significant. Load the spacecraft's clock kernel.
   *
   * The input is well-formed UTF-8 text without an embedded NUL. Empty input
   * signals SPICE(EMPTYSTRING). Blank or malformed fields reach CSPICE.
   * WASM limits the terminated input buffer to 256 MiB.
   *
   * sc is a signed 32-bit spacecraft ID except -2147483648, since the
   * pinned clock routines negate it to construct kernel variable names.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sctiks_c.html
   */
  sctiks(sc: number, clkstr: string): number;

  /**
   * Convert ET seconds past J2000 to a partitioned clock string, rounded to the
   * nearest tick, for a signed 32-bit spacecraft ID. Requires its clock kernel
   * and any conversion information required by that clock's time system.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sce2s_c.html
   */
  sce2s(sc: number, et: number): string;

  /**
   * Encode an SCLK string into "ticks".
   *
   * Kernel prerequisites:
   * - Requires an SCLK kernel to be loaded.
   *
   * The signed 32-bit spacecraft ID selects the clock. Partition information
   * is reflected in encoded ticks; omitted partitions are inferred when possible.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/scencd_c.html
   */
  scencd(sc: number, sclkch: string): number;

  /**
   * Decode SCLK "ticks" into an SCLK string.
   *
   * Kernel prerequisites:
   * - Requires an SCLK kernel to be loaded.
   *
   * The signed 32-bit spacecraft ID selects the clock. Fractional ticks round
   * to the nearest tick; a shared boundary decodes to the later partition.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/scdecd_c.html
   */
  scdecd(sc: number, sclkdp: number): string;

  /**
   * Convert SCLK "ticks" to ET seconds past J2000.
   *
   * Kernel prerequisites:
   * - Requires an SCLK kernel to be loaded.
   * - Often requires an LSK (leapseconds) kernel as well (see NAIF docs).
   *
   * The signed 32-bit spacecraft ID selects the clock. Fractional encoded
   * ticks are retained during ET conversion, including partition offsets.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sct2e_c.html
   */
  sct2e(sc: number, sclkdp: number): number;

  /**
   * Convert ET seconds past J2000 to SCLK "ticks".
   *
   * Kernel prerequisites:
   * - Requires an SCLK kernel to be loaded.
   * - Often requires an LSK (leapseconds) kernel as well (see NAIF docs).
   *
   * The signed 32-bit spacecraft ID selects the clock. Fractional ticks are
   * retained; this differs from the rounded formatted result of sce2s.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sce2c_c.html
   */
  sce2c(sc: number, et: number): number;
}
