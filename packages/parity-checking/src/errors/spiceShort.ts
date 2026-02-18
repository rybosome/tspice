/**
 * Extract the SPICE short error *symbol* (e.g. `SPKINSUFFDATA`) from a raw
 * short error string.
 *
 * Accepts common forms like:
 *   - `SPICE(FOO)`
 *   - `SPICE ( FOO )`
 *   - `... SPICE(FOO) ...`
 *   - `FOO`
 *
 * Returns a best-effort uppercased symbol, or `null` when a symbol cannot be
 * extracted.
 */
export function spiceShortSymbol(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // Extract the canonical short error *symbol* from common token forms.
  const m = /SPICE\s*\(\s*([A-Za-z0-9_]+)\s*\)/i.exec(trimmed);
  if (m) return m[1]!.toUpperCase();

  // If the raw value already looks like a bare short symbol, normalize case.
  if (/^[A-Za-z0-9_]+$/.test(trimmed)) return trimmed.toUpperCase();

  return null;
}

/** @deprecated Prefer `spiceShortSymbol()` (this helper returns a symbol). */
export const spiceShortCode = spiceShortSymbol;
