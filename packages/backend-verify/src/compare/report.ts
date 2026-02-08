import type { Mismatch } from "./types.js";
import { normalizeForCompare } from "./normalize.js";
import { safeStringify } from "./safeStringify.js";

export function formatMismatchReport(mismatches: Mismatch[]): string {
  if (mismatches.length === 0) return "(no mismatches)";

  return mismatches
    .map((m) => {
      const expected = safeStringify(normalizeForCompare(m.expected));
      const actual = safeStringify(normalizeForCompare(m.actual));
      return `${m.path}: ${m.message}\n  expected: ${expected}\n  actual:   ${actual}`;
    })
    .join("\n");
}
