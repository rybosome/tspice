/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*/
export interface TimeApi {
  spiceVersion(): string;

  /**
   * Thin wrapper over the SPICE primitive `tkvrsn()`.
   *
   * Currently, only the TOOLKIT item is exposed.
   */
  tkvrsn(item: "TOOLKIT"): string;

  // --- core conversions ----------------------------------------------------

  /** Convert a time string to ET seconds past J2000. */
  str2et(time: string): number;

  /** Convert ET seconds past J2000 to a formatted UTC string. */
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
   * Wrapper around CSPICE `deltet_c`.
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
   * Parse a time string to ET seconds past J2000.
   *
   * Statefulness: this is affected by TIMDEF defaults (SYSTEM/CALENDAR/ZONE).
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
