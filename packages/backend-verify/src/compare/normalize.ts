function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * A deterministic key for sorting normalized values.
 *
 * We avoid raw JSON.stringify() here because it can:
 * - collapse distinct values (e.g. -0 vs 0, NaN/Infinity -> null)
 * - throw (e.g. BigInt)
 *
 * When keys collide, JS sort stability would make ordering depend on insertion
 * order (and historically, engine details). This makes tie-breaks explicit.
 */
function sortKey(value: unknown): string {
  if (value === null) return "null:";

  switch (typeof value) {
    case "string":
      return `str:${JSON.stringify(value)}`;
    case "number": {
      if (Object.is(value, -0)) return "num:-0";
      if (Number.isNaN(value)) return "num:NaN";
      if (value === Infinity) return "num:Infinity";
      if (value === -Infinity) return "num:-Infinity";
      return `num:${String(value)}`;
    }
    case "bigint":
      return `bigint:${value.toString()}`;
    case "boolean":
      return `bool:${value ? 1 : 0}`;
    case "undefined":
      return "undef:";
    case "symbol":
      return `symbol:${String(value)}`;
    case "function":
      return `function:${String(value)}`;
    case "object":
      break;
  }

  // Objects (arrays/plain objects) are expected to be pre-normalized, but we
  // still stringify them in a BigInt-safe way.
  if (Array.isArray(value)) {
    return `arr:[${value.map(sortKey).join(",")}]`;
  }

  if (isPlainObject(value)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `obj:{${keys.map((k) => `${JSON.stringify(k)}:${sortKey(obj[k])}`).join(",")}}`;
  }

  // Fallback: best-effort.
  try {
    const s = JSON.stringify(value);
    return `obj:${s ?? String(value)}`;
  } catch {
    return `obj:${String(value)}`;
  }
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
    const out = Array.from(value.entries()).map(
      ([k, v]) => [normalizeForCompare(k), normalizeForCompare(v)] as const,
    );

    out.sort((a, b) => {
      const ak = sortKey(a[0]);
      const bk = sortKey(b[0]);
      if (ak < bk) return -1;
      if (ak > bk) return 1;

      const av = sortKey(a[1]);
      const bv = sortKey(b[1]);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });

    return out;
  }

  if (value instanceof Set) {
    const out = Array.from(value.values()).map((v) => normalizeForCompare(v));

    out.sort((a, b) => {
      const ak = sortKey(a);
      const bk = sortKey(b);
      if (ak < bk) return -1;
      if (ak > bk) return 1;
      return 0;
    });

    return out;
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
