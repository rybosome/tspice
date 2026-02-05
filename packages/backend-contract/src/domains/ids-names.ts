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
}
