import { Mat3 } from "../../kit/math/mat3.js";

/**
 * Values sent across the worker boundary must be structured-clone-safe.
 *
 * This codec provides a minimal, extensible tagged encoding for non-plain
 * objects (e.g. `Mat3`) used by the tspice API.
 */

const tspiceRpcTagKey = "__tspiceRpcTag" as const;

type Mat3RowMajorInput = Parameters<typeof Mat3.fromRowMajor>[0];

type TaggedMat3RowMajor = {
  [tspiceRpcTagKey]: "Mat3";
  layout: "rowMajor";
  data: readonly number[];
};


type TaggedRecord = Record<string, unknown> & {
  [tspiceRpcTagKey]?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isTaggedRecord(value: unknown): value is TaggedRecord {
  return isRecord(value) && tspiceRpcTagKey in value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMat3RowMajorData(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.length === 9 && value.every(isFiniteNumber);
}

/** Encode an arbitrary value into a structured-clone-safe shape. */
export function encodeRpcValue(value: unknown): unknown {
  if (value instanceof Mat3) {
    const data = Array.from(value.rowMajor as readonly number[]);
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
  if (isTaggedRecord(value)) {
    const tag = value[tspiceRpcTagKey];

    if (tag === "Mat3") {
      const layout = value.layout;
      const data = value.data;

      if (layout === "rowMajor" && isMat3RowMajorData(data)) {
        // Mat3.fromRowMajor expects a branded Mat3RowMajor type. We validated
        // the runtime shape here, so the cast is safe.
        return Mat3.fromRowMajor(data as unknown as Mat3RowMajorInput);
      }
    }
  }

  if (Array.isArray(value)) {
    return value.map(decodeRpcValue);
  }

  if (isRecord(value)) {
    // Preserve non-plain objects (e.g. TypedArrays) as-is.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = decodeRpcValue(v);
    }
    return out;
  }

  return value;
}
