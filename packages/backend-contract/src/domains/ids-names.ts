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

  /**
   * Return true if a body constant exists in the kernel pool.
   *
   * Normalization:
   * - `item` is normalized as `normalizeBodItem(item)` (trim + ASCII-only uppercase)
   *   before lookup.
   */
  bodfnd(body: number, item: string): boolean;

  /**
   * Return values of a body constant from the kernel pool.
   *
   * Normalization:
   * - `item` is normalized as `normalizeBodItem(item)` (trim + ASCII-only uppercase)
   *   before lookup.
   *
   * Missing-item semantics:
   * - If `item` is not found for `body` (or is non-numeric), returns `[]`.
   * - Call `bodfnd(body, item)` if you need a strict presence check.
   */
  bodvar(body: number, item: string): number[];
}

/**
* Normalize a body-constant item name for `bodfnd` / `bodvar` lookups.
*
* Body-constant item names are treated as case-insensitive by CSPICE, but CSPICE's
* casing behavior is ASCII-based. We intentionally avoid `String.prototype.toUpperCase()`
* here because it applies Unicode case mappings (e.g. `"ß" -> "SS"`), which can
* change lookup keys in surprising ways.
*/
export function normalizeBodItem(item: string): string {
  return toAsciiUppercase(item.trim());
}

function toAsciiUppercase(s: string): string {
  // JS toUpperCase() is locale-sensitive and handles unicode.
  // For kernel pool item names, we only want to uppercase ASCII a-z.
  //
  // Performance: avoid allocating a new string if no changes are needed.
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const isAsciiLower = code >= 97 /* 'a' */ && code <= 122 /* 'z' */;
    if (!isAsciiLower) continue;

    const codes = new Array<number>(s.length);
    for (let j = 0; j < i; j++) {
      codes[j] = s.charCodeAt(j);
    }

    for (let j = i; j < s.length; j++) {
      const cj = s.charCodeAt(j);
      codes[j] = cj >= 97 /* 'a' */ && cj <= 122 /* 'z' */ ? cj - 32 : cj;
    }

    return String.fromCharCode(...codes);
  }

  return s;
}
