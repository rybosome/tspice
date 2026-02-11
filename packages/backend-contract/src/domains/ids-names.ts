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

/**
* Normalize a body-constant item name for `bodfnd` / `bodvar` lookups.
*
* Body-constant item names are treated as case-insensitive by CSPICE, but CSPICE's
* casing behavior is ASCII-based. We intentionally avoid `String.prototype.toUpperCase()`
* here because it applies Unicode case mappings (e.g. `"ß" -> "SS"`), which can
* change lookup keys in surprising ways.
*
* We intentionally trim **ASCII whitespace only** (space/tab/newline/etc.) to match
* CSPICE behavior and keep native + WASM backends consistent.
*/
export function normalizeBodItem(item: string): string {
  return toAsciiUppercase(trimAsciiWhitespace(item));
}

function isAsciiWhitespace(code: number): boolean {
  // Keep this consistent with the native backend implementation.
  return (
    code === 32 /* ' ' */ ||
    code === 9 /* '	' */ ||
    code === 10 /* '
' */ ||
    code === 13 /* '\r' */ ||
    code === 12 /* '' */ ||
    code === 11 /* '\v' */
  );
}

function trimAsciiWhitespace(s: string): string {
  let start = 0;
  while (start < s.length && isAsciiWhitespace(s.charCodeAt(start))) {
    start++;
  }

  let end = s.length;
  while (end > start && isAsciiWhitespace(s.charCodeAt(end - 1))) {
    end--;
  }

  if (start === 0 && end === s.length) {
    return s;
  }

  return s.slice(start, end);
}

function toAsciiUppercase(s: string): string {
  // JS `toUpperCase()` applies Unicode case mappings (e.g. "ß" -> "SS").
  // For kernel pool item names, we only want to uppercase ASCII a-z.
  //
  // Performance: avoid allocating a new string if no changes are needed.
  // Safety: avoid building `String.fromCharCode(...bigArray)` arg lists.
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const isAsciiLower = code >= 97 /* 'a' */ && code <= 122 /* 'z' */;
    if (!isAsciiLower) continue;

    // We found at least one lowercase ASCII letter; build the output string.
    // Chunked to avoid large temporary allocations and arg limits.
    let out = s.slice(0, i);
    const chunkSize = 4096;

    for (let j = i; j < s.length; j += chunkSize) {
      const end = Math.min(s.length, j + chunkSize);
      const codes = new Array<number>(end - j);

      for (let k = j; k < end; k++) {
        const ck = s.charCodeAt(k);
        codes[k - j] = ck >= 97 /* 'a' */ && ck <= 122 /* 'z' */ ? ck - 32 : ck;
      }

      out += String.fromCharCode.apply(null, codes as unknown as number[]);
    }

    return out;
  }

  return s;
}
