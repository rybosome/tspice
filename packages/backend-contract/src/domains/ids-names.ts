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
