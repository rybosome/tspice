function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizePlainObject(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = Object.keys(value).sort();
  for (const k of keys) {
    out[k] = normalizeForCompare(value[k]);
  }
  return out;
}

function taggedObject(value: object, props: Record<string, unknown>): Record<string, unknown> {
  const ctor = (value as { constructor?: { name?: unknown } }).constructor;
  const $type = typeof ctor?.name === "string" && ctor.name.length > 0 ? ctor.name : "Object";

  return {
    $type,
    $tag: Object.prototype.toString.call(value),
    props: normalizePlainObject(props),
  };
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

const FNV1A64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV1A64_PRIME = 0x100000001b3n;
const FNV1A64_MASK = 0xffffffffffffffffn;
const textEncoder = new TextEncoder();

function fnv1a64Update(h: bigint, s: string): bigint {
  // Encode as UTF-8 bytes for stable cross-platform hashing.
  for (const b of textEncoder.encode(s)) {
    h ^= BigInt(b);
    h = (h * FNV1A64_PRIME) & FNV1A64_MASK;
  }
  return h;
}

function hashSortKey(value: unknown, h: bigint = FNV1A64_OFFSET_BASIS): bigint {
  // Arrays/plain objects get structural hashing to avoid huge intermediary
  // strings. Everything else falls back to the readable sortKey() form.
  if (Array.isArray(value)) {
    h = fnv1a64Update(h, "arr:[");
    for (const v of value) {
      h = hashSortKey(v, h);
      h = fnv1a64Update(h, ",");
    }
    return fnv1a64Update(h, "]");
  }

  if (isPlainObject(value)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();

    h = fnv1a64Update(h, "obj:{");
    for (const k of keys) {
      h = fnv1a64Update(h, JSON.stringify(k));
      h = fnv1a64Update(h, ":");
      h = hashSortKey(obj[k], h);
      h = fnv1a64Update(h, ",");
    }
    return fnv1a64Update(h, "}");
  }

  return fnv1a64Update(h, sortKey(value));
}

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

  // Arrays/plain objects are expected to be pre-normalized, but can still be
  // enormous (and deep). Avoid deep-expanding them into huge strings.
  if (Array.isArray(value) || isPlainObject(value)) {
    const h = hashSortKey(value);
    return `h:${h.toString(16).padStart(16, "0")}`;
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
    const timeMs = value.getTime();
    return taggedObject(value, {
      timeMs,
      ...(Number.isFinite(timeMs) ? { iso: value.toISOString() } : {}),
    });
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

    return taggedObject(value, {
      entries: outWithKeys.map((x) => x.entry),
    });
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

    return taggedObject(value, {
      values: outWithKeys.map((x) => x.value),
    });
  }

  if (value instanceof Error) {
    const err = value as Error & { cause?: unknown };
    const props: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };

    if ("cause" in err && err.cause !== undefined) {
      props.cause = err.cause;
    }

    // Include any custom enumerable fields (e.g. `code`, `spiceShort`, etc.).
    for (const k of Object.keys(err).sort()) {
      if (k === "name" || k === "message" || k === "cause") continue;
      try {
        props[k] = (err as unknown as Record<string, unknown>)[k];
      } catch (e) {
        props[k] = `[throws ${e instanceof Error ? e.message : String(e)}]`;
      }
    }

    return taggedObject(err, props);
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

  if (isPlainObject(value)) {
    return normalizePlainObject(value);
  }

  if (typeof value === "object" && value !== null) {
    const props: Record<string, unknown> = {};

    // Use enumerable props only; non-enumerables (like `Error.stack`) are often
    // environment-dependent and not stable.
    for (const k of Object.keys(value as Record<string, unknown>)) {
      try {
        props[k] = (value as Record<string, unknown>)[k];
      } catch (e) {
        props[k] = `[throws ${e instanceof Error ? e.message : String(e)}]`;
      }
    }

    return taggedObject(value, props);
  }

  // Fallback (e.g. symbols/functions): best-effort stable representation.
  return String(value);
}
