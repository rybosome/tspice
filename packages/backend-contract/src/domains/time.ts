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

  /** Convert ET seconds past J2000 to a formatted UTC string. */
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
   * Wrapper around CSPICE `deltet_c`.
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

  /** Convert an encoded SCLK string to ET seconds past J2000. */
  scs2e(sc: number, sclkch: string): number;

  /** Convert ET seconds past J2000 to an encoded SCLK string. */
  sce2s(sc: number, et: number): string;

  /**
   * Encode an SCLK string into "ticks".
   *
   * Kernel prerequisites:
   * - Requires an SCLK kernel to be loaded.
   *
   * Wrapper around CSPICE `scencd_c`.
   */
  scencd(sc: number, sclkch: string): number;

  /**
   * Decode SCLK "ticks" into an SCLK string.
   *
   * Kernel prerequisites:
   * - Requires an SCLK kernel to be loaded.
   *
   * Wrapper around CSPICE `scdecd_c`.
   */
  scdecd(sc: number, sclkdp: number): string;

  /**
   * Convert SCLK "ticks" to ET seconds past J2000.
   *
   * Kernel prerequisites:
   * - Requires an SCLK kernel to be loaded.
   * - Often requires an LSK (leapseconds) kernel as well (see NAIF docs).
   *
   * Wrapper around CSPICE `sct2e_c`.
   */
  sct2e(sc: number, sclkdp: number): number;

  /**
   * Convert ET seconds past J2000 to SCLK "ticks".
   *
   * Kernel prerequisites:
   * - Requires an SCLK kernel to be loaded.
   * - Often requires an LSK (leapseconds) kernel as well (see NAIF docs).
   *
   * Wrapper around CSPICE `sce2c_c`.
   */
  sce2c(sc: number, et: number): number;
}
