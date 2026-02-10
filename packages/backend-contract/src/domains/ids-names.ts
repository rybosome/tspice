/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*/
import type { Found } from "../shared/types.js";

export interface IdsNamesApi {
  bodn2c(name: string): Found<{ code: number }>;
  bodc2n(code: number): Found<{ name: string }>;

  /** Map a NAIF body ID code to a name (or decimal string if unknown). */
  bodc2s(code: number): string;

  /** Map a body name or numeric string to a NAIF body ID code. */
  bods2c(name: string): Found<{ code: number }>;

  /** Define a body name/code mapping (side effect). */
  boddef(name: string, code: number): void;

  /** Return true if a body constant exists in the kernel pool. */
  bodfnd(body: number, item: string): boolean;

  /** Return values of a body constant from the kernel pool. */
  bodvar(body: number, item: string): number[];
}
