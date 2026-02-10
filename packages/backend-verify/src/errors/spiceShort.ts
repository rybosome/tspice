export function spiceShortCode(raw: string): string {
  const trimmed = raw.trim();

  // Canonicalize common SPICE short forms like:
  //   "SPICE(FOO)"
  //   "SPICE ( FOO )"
  //   "... SPICE(FOO) ..."
  // without mutating the stored value—this is for comparisons/logging.
  const m = /SPICE\s*\(\s*([A-Za-z0-9_]+)\s*\)/i.exec(trimmed);
  if (m) return `SPICE(${m[1]!.toUpperCase()})`;

  return trimmed;
}
