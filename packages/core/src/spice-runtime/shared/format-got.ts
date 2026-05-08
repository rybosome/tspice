/**
 * Stringify arbitrary runtime values for `Expected/Got` error messages.
 *
 * Prefers JSON formatting when available, but safely falls back to `String()`
 * when JSON serialization fails (e.g. circular objects, BigInt values).
 */
export function formatGot(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    if (json !== undefined) {
      return json;
    }
  } catch {
    // Fall back to string coercion.
  }

  return String(value);
}
