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

  // TypedArrays + DataView
  //
  // NOTE: DataView is *not* a numeric ArrayLike, so Array.from(new DataView(...))
  // produces an empty array. Normalize it to the underlying bytes explicitly.
  if (value instanceof DataView) {
    return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }

  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>);
  }

  if (value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value));
  }

  if (value instanceof Map) {
    // Cache sort keys so we don't recompute expensive keys repeatedly during sort.
    // This preserves deterministic ordering identical to the comparator logic.
    const outWithKeys = Array.from(value.entries()).map(([k, v]) => {
      const nk = normalizeForCompare(k);
      const nv = normalizeForCompare(v);
      return {
        entry: [nk, nv] as const,
        keyKey: sortKey(nk),
        valueKey: sortKey(nv),
      };
    });

    outWithKeys.sort((a, b) => {
      if (a.keyKey < b.keyKey) return -1;
      if (a.keyKey > b.keyKey) return 1;
      if (a.valueKey < b.valueKey) return -1;
      if (a.valueKey > b.valueKey) return 1;
      return 0;
    });

    return outWithKeys.map((x) => x.entry);
  }

  if (value instanceof Set) {
    // Same caching approach as Map normalization.
    const outWithKeys = Array.from(value.values()).map((v) => {
      const nv = normalizeForCompare(v);
      return { value: nv, key: sortKey(nv) };
    });

    outWithKeys.sort((a, b) => {
      if (a.key < b.key) return -1;
      if (a.key > b.key) return 1;
      return 0;
    });

    return outWithKeys.map((x) => x.value);
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
