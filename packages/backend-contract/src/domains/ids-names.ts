/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type { Found } from "../shared/types.js";

/** Backend contract for NAIF ID/name and body-constant lookups. */
export interface IdsNamesApi {
  /** SPICE `bodn2c_c`: look up a NAIF body ID code by name. */
  bodn2c(name: string): Found<{ code: number }>;
  /** SPICE `bodc2n_c`: look up a body name by NAIF ID code. */
  bodc2n(code: number): Found<{ name: string }>;

  /** Map a NAIF body ID code to a name (or decimal string if unknown). */
  bodc2s(code: number): string;

  /** Map a body name or numeric string to a NAIF body ID code. */
  bods2c(name: string): Found<{ code: number }>;

  /** Define a body name/code mapping (side effect). */
  boddef(name: string, code: number): void;

  /**
   * Return true if a body constant exists in the kernel pool.
   *
   * Normalization:
   * - `item` is normalized as `normalizeBodItem(item)` (trim ASCII whitespace + ASCII-only uppercase)
   *   before lookup.
   */
  bodfnd(body: number, item: string): boolean;

  /**
   * Return values of a body constant from the kernel pool.
   *
   * Normalization:
   * - `item` is normalized as `normalizeBodItem(item)` (trim ASCII whitespace + ASCII-only uppercase)
   *   before lookup.
   *
   * Missing-item semantics:
   * - If `item` is not found for `body` (or is non-numeric), returns `[]`.
   * - Call `bodfnd(body, item)` if you need a strict presence check.
   */
  bodvar(body: number, item: string): number[];
}
