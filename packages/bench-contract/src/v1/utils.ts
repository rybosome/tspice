/** Type guard for plain object records (non-null, non-array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Type guard for non-empty (trimmed) strings. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Type guard for `Object.prototype.hasOwnProperty.call(...)` with key narrowing. */
export function hasOwn<K extends string>(
  value: Record<string, unknown>,
  key: K,
): value is Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}
