import { invariant } from "@rybosome/tspice-core";

type TypedArrayView =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

function isTypedArrayView(x: unknown): x is TypedArrayView {
  // `ArrayBuffer.isView()` is true for TypedArrays *and* DataView.
  return ArrayBuffer.isView(x) && !(x instanceof DataView);
}

function isArrayLike(x: unknown): x is ArrayLike<unknown> {
  return (
    x !== null &&
    typeof x === "object" &&
    (Array.isArray(x) || isTypedArrayView(x)) &&
    typeof (x as ArrayLike<unknown>).length === "number"
  );
}

function assertArrayLikeFiniteLength(
  value: unknown,
  expectedLength: number,
  label: string,
): asserts value is ArrayLike<number> {
  invariant(isArrayLike(value), `${label}: expected an array-like result`);
  invariant((value as ArrayLike<unknown>).length === expectedLength, `${label}: expected length ${expectedLength}`);

  for (let i = 0; i < expectedLength; i++) {
    const v = (value as ArrayLike<unknown>)[i];
    invariant(typeof v === "number" && Number.isFinite(v), `${label}: expected finite number at index ${i}`);
  }
}

export function assertLength3(value: unknown, label = "Vec3"): asserts value is ArrayLike<number> {
  assertArrayLikeFiniteLength(value, 3, label);
}

export function assertLength6(value: unknown, label = "Vec6"): asserts value is ArrayLike<number> {
  assertArrayLikeFiniteLength(value, 6, label);
}

export function assertLength9(value: unknown, label = "Mat3"): asserts value is ArrayLike<number> {
  assertArrayLikeFiniteLength(value, 9, label);
}

export function assertLength36(value: unknown, label = "Mat6"): asserts value is ArrayLike<number> {
  assertArrayLikeFiniteLength(value, 36, label);
}
