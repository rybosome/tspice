import type { Vec3, Vec6 } from "./types.js";

type FreezeMode = "never" | "dev" | "always";

export type BrandVecOptions = {
  /**
   * Used for error messages (e.g. `"spkezr()"`).
   *
   * Defaults to `"Vec"`.
   */
  readonly label?: string;

  /**
   * If set, freeze branded values to prevent mutation at runtime.
   *
   * Defaults to `"dev"`.
   */
  readonly freeze?: FreezeMode;
};

const DEFAULT_FREEZE_MODE: FreezeMode = "dev";

// Runtime-only brands. These are intentionally module-private so we don't leak
// symbols into the public API surface (brands are type-level only).
const VEC3_BRAND = Symbol("Vec3");
const VEC6_BRAND = Symbol("Vec6");

function isDevEnv(): boolean {
  // Safe in non-node runtimes.
  return typeof process !== "undefined" && process?.env?.NODE_ENV !== "production";
}

function shouldFreeze(mode: FreezeMode): boolean {
  switch (mode) {
    case "never":
      return false;
    case "always":
      return true;
    case "dev":
      return isDevEnv();
  }
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

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
  // We intentionally only accept numeric TypedArrays (not BigInt views, not DataView).
  return (
    x instanceof Int8Array ||
    x instanceof Uint8Array ||
    x instanceof Uint8ClampedArray ||
    x instanceof Int16Array ||
    x instanceof Uint16Array ||
    x instanceof Int32Array ||
    x instanceof Uint32Array ||
    x instanceof Float32Array ||
    x instanceof Float64Array
  );
}

function isLengthArrayLike(x: unknown, expectedLength: number): x is ArrayLike<unknown> {
  return (
    x !== null &&
    typeof x === "object" &&
    (Array.isArray(x) || isTypedArrayView(x)) &&
    typeof (x as ArrayLike<unknown>).length === "number" &&
    (x as ArrayLike<unknown>).length === expectedLength
  );
}

function formatVecError(label: string, expectedLength: number, detail: string): string {
  return `${label}: expected a length-${expectedLength} array of finite numbers (${detail})`;
}

function tryDefineBrand(target: object, brand: symbol): void {
  try {
    // Non-enumerable to avoid surprising JSON/stringification behavior.
    Object.defineProperty(target, brand, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  } catch {
    // Best-effort: some exotic objects may be non-extensible.
  }
}

function maybeFreeze<T extends object>(value: T, mode: FreezeMode): T {
  if (!shouldFreeze(mode)) return value;
  try {
    return Object.freeze(value);
  } catch {
    return value;
  }
}

function assertVecArrayLikeFinite(
  value: unknown,
  options: { readonly label: string; readonly length: number },
): asserts value is ArrayLike<number> {
  const { label, length } = options;

  if (value instanceof DataView) {
    throw new Error(`${label}: DataView is not a supported vector input (use a TypedArray or number[]).`);
  }

  if (!isLengthArrayLike(value, length)) {
    throw new Error(formatVecError(label, length, "wrong shape"));
  }

  for (let i = 0; i < length; i++) {
    const v = value[i];
    if (!isFiniteNumber(v)) {
      throw new Error(formatVecError(label, length, `index ${i} was ${String(v)}`));
    }
  }
}

export function assertVec3ArrayLike3(value: unknown, options?: { readonly label?: string }): asserts value is ArrayLike<number> {
  assertVecArrayLikeFinite(value, { label: options?.label ?? "Vec3", length: 3 });
}

export function assertVec6ArrayLike6(value: unknown, options?: { readonly label?: string }): asserts value is ArrayLike<number> {
  assertVecArrayLikeFinite(value, { label: options?.label ?? "Vec6", length: 6 });
}

export function brandVec3(value: unknown, options?: BrandVecOptions): Vec3 {
  const label = options?.label ?? "Vec3";
  const freeze = options?.freeze ?? DEFAULT_FREEZE_MODE;

  assertVec3ArrayLike3(value, { label });

  const arr = Array.from(value);
  tryDefineBrand(arr, VEC3_BRAND);
  return maybeFreeze(arr, freeze) as unknown as Vec3;
}

export function brandVec6(value: unknown, options?: BrandVecOptions): Vec6 {
  const label = options?.label ?? "Vec6";
  const freeze = options?.freeze ?? DEFAULT_FREEZE_MODE;

  assertVec6ArrayLike6(value, { label });

  const arr = Array.from(value);
  tryDefineBrand(arr, VEC6_BRAND);
  return maybeFreeze(arr, freeze) as unknown as Vec6;
}

/**
 * Structural check: accepts number[] and numeric TypedArrays (excludes DataView).
 *
 * This does **not** assert/require that the value is branded as a `Vec3`.
 */
export function isVec3ArrayLike3(value: unknown): value is ArrayLike<number> {
  if (value instanceof DataView) return false;
  if (!isLengthArrayLike(value, 3)) return false;
  for (let i = 0; i < 3; i++) {
    if (!isFiniteNumber(value[i])) return false;
  }
  return true;
}

/**
 * Structural check: accepts number[] and numeric TypedArrays (excludes DataView).
 *
 * This does **not** assert/require that the value is branded as a `Vec6`.
 */
export function isVec6ArrayLike6(value: unknown): value is ArrayLike<number> {
  if (value instanceof DataView) return false;
  if (!isLengthArrayLike(value, 6)) return false;
  for (let i = 0; i < 6; i++) {
    if (!isFiniteNumber(value[i])) return false;
  }
  return true;
}

/**
 * Brand-only check: verifies that a value was produced by `brandVec3()`.
 *
 * Note: this intentionally rejects structurally-valid TypedArrays.
 */
export function isBrandedVec3(value: unknown): value is Vec3 {
  if (!isLengthArrayLike(value, 3)) return false;
  return Boolean((value as unknown as Record<symbol, unknown>)[VEC3_BRAND]);
}

/**
 * Brand-only check: verifies that a value was produced by `brandVec6()`.
 *
 * Note: this intentionally rejects structurally-valid TypedArrays.
 */
export function isBrandedVec6(value: unknown): value is Vec6 {
  if (!isLengthArrayLike(value, 6)) return false;
  return Boolean((value as unknown as Record<symbol, unknown>)[VEC6_BRAND]);
}
