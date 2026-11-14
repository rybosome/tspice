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

  /**
   * Format finite ephemeris seconds from J2000 on the formal Gregorian calendar
   * with 86400-second days. No kernels are needed. N0067 supplies boundary text
   * for epochs beyond its calendar day limits. callen includes the terminator,
   * defaults to 181 and truncates smaller valid outputs; below 2 signals STRINGTOOSHORT.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/etcal_c.html
   */
  etcal(et: number, callen?: number): string;
  /**
   * Convert a legacy UTC calendar, day-of-year or Julian-date string to ET.
   * Requires leap-second information. Calendar checking and two-digit years use
   * the current TPARCH/TSETYR settings. Explicit zones, AM/PM or alternate
   * systems produce INVALIDTIMESTRING. Unrepresentable signed calendar/LSK day
   * arithmetic is rejected before conversion.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/utc2et_c.html
   */
  utc2et(utcstr: string): number;
  /**
   * Change the toolkit's persistent parsing mode. A nonempty string matching
   * YES under CSPICE comparison enables calendar checks; other nonempty values
   * select permissive parsing. Native clients share this process setting.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/tparch_c.html
   */
  tparch(type: string): void;
  /**
   * Set the first year of the 100-year window used to expand two-digit dates.
   * Nonpositive signed integers leave it unchanged. The largest supported
   * lower bound is 5851355 so every expanded year fits TPARSE's year*367.
   * This parsing setting persists across kernel clears and native clients.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/tsetyr_c.html
   */
  tsetyr(year: number): void;
  /**
   * Return local solar clock fields and both formatted strings at ET, at the
   * given longitude in radians. PLANETOCENTRIC is east-positive; PLANETOGRAPHIC
   * uses the body's longitude convention. Except for the Sun's noon shortcut,
   * the body-fixed frame, Sun ephemeris and rotation rate must be available.
   * Planetographic longitude is converted before the Sun shortcut. Signed
   * capacities include NUL and default to 9 and 14. INT_MIN body lookup and
   * undefined numerical narrowing are rejected.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/et2lst_c.html
   */
  et2lst(
    et: number,
    body: number,
    lon: number,
    type: string,
    timlen?: number,
    ampmlen?: number,
  ): { hr: number; mn: number; sc: number; time: string; ampm: string };

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
