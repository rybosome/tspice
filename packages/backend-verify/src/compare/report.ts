import type { Mismatch } from "./types.js";
import { normalizeForCompare } from "./normalize.js";

function safeStringify(value: unknown): string {
  if (typeof value === "bigint") return `${value.toString()}n`;
  try {
    const s = JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? `${v.toString()}n` : v));
    return s ?? String(value);
  } catch {
    return String(value);
  }
}

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
