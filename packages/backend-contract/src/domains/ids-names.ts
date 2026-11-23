/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type { Found } from "../shared/types.js";

/** Backend contract for NAIF ID/name and body-constant lookups. */
export interface IdsNamesApi {
  /**
   * Translate a signed surface and body ID to the latest pool-defined name, preserving case and embedded blanks. If no name exists, surface is the decimal ID and isName is false. Optional signed32 srflen counts bytes including NUL; by default it holds all 36 name bytes and the terminator. Small capacities retain toolkit truncation; below two signals STRINGTOOSHORT. A truncated UTF-8 scalar cannot be represented and throws TypeError. Surface associations come from NAIF_SURFACE_NAME, NAIF_SURFACE_CODE and NAIF_SURFACE_BODY. Malformed mappings signal CSPICE errors.
   * N0067 cannot hash surface ID -2147483648. Direct surface codes and NAIF_SURFACE_CODE pool values rounding to that ID are rejected before entering the translation routine.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/srfc2s_c.html
   */
  srfc2s(
    code: number,
    bodyId: number,
    srflen?: number,
  ): { surface: string; isName: boolean };
  /**
   * Translate a signed surface ID and body name or numeric body string. Unknown bodies or unmapped surfaces return the decimal surface ID with isName false. Optional signed32 srflen counts bytes including NUL; by default it holds all 36 name bytes and the terminator. Small capacities retain toolkit truncation; below two signals STRINGTOOSHORT. A truncated UTF-8 scalar cannot be represented and throws TypeError. Surface associations come from NAIF_SURFACE_NAME, NAIF_SURFACE_CODE and NAIF_SURFACE_BODY. Malformed mappings signal CSPICE errors. Text must be well-formed, without embedded NUL. Empty strings reach CSPICE; WASM limits each encoded buffer to 256 MiB.
   * N0067 cannot hash surface ID -2147483648. Direct surface codes and NAIF_SURFACE_CODE pool values rounding to that ID are rejected before entering the translation routine.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/srfcss_c.html
   */
  srfcss(
    code: number,
    body: string,
    srflen?: number,
  ): { surface: string; isName: boolean };
  /**
   * Resolve a surface name or numeric string for a recognized body name or numeric body string. A mapped name takes precedence over number parsing; an unknown body returns found:false even for numeric surfaces. Surface associations come from NAIF_SURFACE_NAME, NAIF_SURFACE_CODE and NAIF_SURFACE_BODY. Malformed mappings signal CSPICE errors. Text must be well-formed, without embedded NUL. Empty strings reach CSPICE; WASM limits each encoded buffer to 256 MiB.
   * N0067 cannot hash surface ID -2147483648. NAIF_SURFACE_CODE pool values rounding to that ID are rejected before entering the translation routine.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/srfs2c_c.html
   */
  srfs2c(surface: string, body: string): Found<{ code: number }>;
  /**
   * Resolve a surface name or numeric string for a signed body ID. Name lookup ignores letter case, leading/trailing ASCII blanks and repeated embedded blanks. If neither lookup nor CSPICE integer parsing succeeds, return found:false without a code. Surface associations come from NAIF_SURFACE_NAME, NAIF_SURFACE_CODE and NAIF_SURFACE_BODY. Malformed mappings signal CSPICE errors. Text must be well-formed, without embedded NUL. Empty strings reach CSPICE; WASM limits each encoded buffer to 256 MiB.
   * N0067 cannot hash surface ID -2147483648. NAIF_SURFACE_CODE pool values rounding to that ID are rejected before entering the translation routine.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/srfscc_c.html
   */
  srfscc(surface: string, bodyId: number): Found<{ code: number }>;
  /**
   * Resolve a body name (case-insensitive, normalized blanks) to a signed NAIF ID.
   * Numeric strings are not interpreted as IDs here; use bods2c for that behavior.
   * Unknown names return found:false; malformed kernel mappings signal errors.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bodn2c_c.html
   */
  bodn2c(name: string): Found<{ code: number }>;
  /**
   * Resolve a signed 32-bit body ID to its latest defined name, preserving case
   * and leading blanks. Unknown IDs return found:false. Kernel mappings take
   * precedence over programmatic definitions.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bodc2n_c.html
   */
  bodc2n(code: number): Found<{ name: string }>;

  /**
   * Resolve a signed 32-bit body ID to its latest name, or decimal ID string when
   * unknown. Leading blanks/case of defined names are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bodc2s_c.html
   */
  bodc2s(code: number): string;

  /**
   * Resolve a normalized body name or signed integer string to a body ID.
   * Unrecognized names/out-of-range numeric strings return found:false.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bods2c_c.html
   */
  bods2c(name: string): Found<{ code: number }>;

  /**
   * Define a name for a signed 32-bit body ID. A later alias becomes the preferred
   * ID-to-name result; earlier aliases still resolve to the ID. Reassigning a name
   * replaces its old mapping. Kernel definitions take precedence. Programmatic
   * definitions persist across kclear for the owning CSPICE process/module.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/boddef_c.html
   */
  boddef(name: string, code: number): void;

  /**
   * Return true if a body constant exists, including character-valued constants.
   * Body must be a signed 32-bit ID. The normalized item must be nonempty and no
   * longer than 1024 input characters. Lookup follows NAIF's 32-byte pool-key
   * construction; a longer item suffix does not change that key.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bodfnd_c.html
   *
   * Normalization:
   * - `item` is normalized as `normalizeBodItem(item)` from `@rybosome/tspice-core`
   *   (trim ASCII whitespace + ASCII-only uppercase)
   *   before lookup.
   */
  bodfnd(body: number, item: string): boolean;

  /**
   * Return all numeric values of a body constant in stored order and caller units.
   * Body must be a signed 32-bit ID; normalized item must be nonempty and at most
   * 1024 input characters. Lookup uses NAIF's 32-byte pool key. Output is sized
   * from actual numeric metadata, rather than truncated to a fixed array cap.
   * This contract composes bounded bodvcd with metadata preflight and preserves
   * its documented missing/non-numeric policy below, unlike legacy bodvar errors.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bodvar_c.html
   *
   * Normalization:
   * - `item` is normalized as `normalizeBodItem(item)` from `@rybosome/tspice-core`
   *   (trim ASCII whitespace + ASCII-only uppercase)
   *   before lookup.
   *
   * Missing-item semantics:
   * - If `item` is not found for `body` (or is non-numeric), returns `[]`.
   * - Call `bodfnd(body, item)` if you need a strict presence check.
   */
  bodvar(body: number, item: string): number[];
}
