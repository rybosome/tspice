import type { Mismatch } from "./types.js";
import { normalizeForCompare } from "./normalize.js";

export function formatMismatchReport(mismatches: Mismatch[]): string {
  if (mismatches.length === 0) return "(no mismatches)";

  return mismatches
    .map((m) => {
      const expected = JSON.stringify(normalizeForCompare(m.expected));
      const actual = JSON.stringify(normalizeForCompare(m.actual));
      return `${m.path}: ${m.message}\n  expected: ${expected}\n  actual:   ${actual}`;
    })
    .join("\n");
}
