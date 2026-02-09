import { Mat3 } from "@rybosome/tspice";

/**
* Values sent across the worker boundary must be structured-clone-safe.
*
* This codec provides a minimal, extensible tagged encoding for non-plain
* objects (e.g. `Mat3`) used by the tspice API.
*/

const tspiceRpcTagKey = "__tspiceRpcTag" as const;

type TaggedMat3RowMajor = {
  [tspiceRpcTagKey]: "Mat3";
  layout: "rowMajor";
  data: readonly number[];
};

type TaggedValue = TaggedMat3RowMajor;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isTaggedValue(value: unknown): value is TaggedValue {
  return (
    isRecord(value) &&
    value[tspiceRpcTagKey] === "Mat3" &&
    (value as any).layout === "rowMajor" &&
    Array.isArray((value as any).data)
  );
}

/** Encode an arbitrary value into a structured-clone-safe shape. */
export function encodeRpcValue(value: unknown): unknown {
  if (value instanceof Mat3) {
    const data = Array.from(value.rowMajor);
    return {
      [tspiceRpcTagKey]: "Mat3",
      layout: "rowMajor",
      data,
    } satisfies TaggedMat3RowMajor;
  }

  if (Array.isArray(value)) {
    return value.map(encodeRpcValue);
  }

  if (isRecord(value)) {
    // Preserve Date/Map/Set/etc as-is? No: those are not guaranteed to be
    // structured-clone-safe across all targets. For now, we only support plain
    // object literals.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = encodeRpcValue(v);
    }
    return out;
  }

  return value;
}

/** Decode a value that was encoded by {@link encodeRpcValue}. */
export function decodeRpcValue(value: unknown): unknown {
  if (isTaggedValue(value)) {
    if (value.__tspiceRpcTag === "Mat3") {
      // Mat3.fromRowMajor expects a branded Mat3RowMajor type. We know this
      // data shape is correct (and validated in tests), so cast is safe.
      return Mat3.fromRowMajor(value.data as any);
    }
  }

  if (Array.isArray(value)) {
    return value.map(decodeRpcValue);
  }

  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = decodeRpcValue(v);
    }
    return out;
  }

  return value;
}
