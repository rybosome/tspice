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
   * Currently, only the TOOLKIT item is exposed.
   */
  tkvrsn(item: "TOOLKIT"): string;

  // --- core conversions ----------------------------------------------------

  /** Convert a time string to ET seconds past J2000. */
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
   * Wrapper around CSPICE `timout_c`.
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
   * Wrapper around CSPICE `unitim_c`.
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
   * Wrapper around CSPICE `tparse_c`.
   */
  tparse(timstr: string): number;

  /**
   * Transform a NAIF time picture to match a sample time string.
   *
   * Statefulness: this is affected by TIMDEF defaults (SYSTEM/CALENDAR/ZONE),
   * since `sample` is interpreted under the current TIMDEF state.
   *
   * Kernel prerequisites:
   * - None.
   *
   * Wrapper around CSPICE `tpictr_c`.
   */
  tpictr(sample: string, pictur: string): string;

  /**
   * Get or set time conversion defaults.
   *
   * Kernel prerequisites:
   * - None.
   *
   * Wrapper around CSPICE `timdef_c`.
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
