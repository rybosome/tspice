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

  // --- low-level primitives ---

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

  // --- SCLK conversions + CK attitude ---

  /** Convert an encoded SCLK string to ET seconds past J2000. */
  scs2e(sc: number, sclkch: string): number;

  /** Convert ET seconds past J2000 to an encoded SCLK string. */
  sce2s(sc: number, et: number): string;
}
