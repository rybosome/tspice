function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function normalizeForCompare(value: unknown): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((v) => normalizeForCompare(v));
  }

  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>);
  }

  if (value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value));
  }

  if (value instanceof Map) {
    return Array.from(value.entries()).map(([k, v]) => [normalizeForCompare(k), normalizeForCompare(v)]);
  }

  if (value instanceof Set) {
    return Array.from(value.values()).map((v) => normalizeForCompare(v));
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value).sort();
    for (const k of keys) {
      out[k] = normalizeForCompare(value[k]);
    }
    return out;
  }

  // Fallback: best-effort stable representation.
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}
