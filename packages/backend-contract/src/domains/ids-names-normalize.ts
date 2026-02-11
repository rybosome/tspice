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
const MAX_BOD_ITEM_CHARS = 1024;

export function normalizeBodItem(item: string): string {
  // Defensive guardrail: kernel pool item names are expected to be short.
  // If a pathological string makes it here (e.g. a multi-megabyte user input),
  // uppercasing it can cause large allocations and unnecessary CPU work.
  //
  // This limit is intentionally *far* above any realistic item name.
  if (item.length > MAX_BOD_ITEM_CHARS) {
    throw new RangeError(
      `Kernel pool item name is too long: ${item.length} characters (max ${MAX_BOD_ITEM_CHARS})`,
    );
  }

  return toAsciiUppercase(trimAsciiWhitespace(item));
}

function isAsciiWhitespace(code: number): boolean {
  // Keep this consistent with the native backend implementation.
  return (
    code === 32 /* ' ' */ ||
    code === 9 /* '\t' */ ||
    code === 10 /* '\n' */ ||
    code === 13 /* '\\r' */ ||
    code === 12 /* '\f' */ ||
    code === 11 /* '\\v' */
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
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const isAsciiLower = code >= 97 /* 'a' */ && code <= 122 /* 'z' */;
    if (!isAsciiLower) continue;

    // We found at least one lowercase ASCII letter; build the output string.
    //
    // Note: `normalizeBodItem()` enforces a max input length, so a simple
    // per-code-unit loop is both safe and low-allocation (no large temp arrays
    // or `fromCharCode(...big)` argument lists).
    let out = s.slice(0, i) + String.fromCharCode(code - 32);
    for (let j = i + 1; j < s.length; j++) {
      const cj = s.charCodeAt(j);
      out += String.fromCharCode(
        cj >= 97 /* 'a' */ && cj <= 122 /* 'z' */ ? cj - 32 : cj,
      );
    }
    return out;
  }

  return s;
}
