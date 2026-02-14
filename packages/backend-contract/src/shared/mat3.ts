import type { Mat3ColMajor, Mat3RowMajor } from "./types.js";

type FreezeMode = "never" | "dev" | "always";

export type BrandMat3Options = {
  /**
   * Used for error messages (e.g. `"pxform()"`).
   *
   * Defaults to `"Mat3"`.
   */
  readonly label?: string;

  /**
   * If set, freeze branded matrices to prevent mutation at runtime.
   *
   * Defaults to `"dev"`.
   */
  readonly freeze?: FreezeMode;
};

const DEFAULT_FREEZE_MODE: FreezeMode = "dev";

// Runtime-only brands. These are intentionally module-private so we don't leak
// symbols into the public API surface (brands are type-level only).
const MAT3_ROW_MAJOR_BRAND = Symbol("Mat3RowMajor");
const MAT3_COL_MAJOR_BRAND = Symbol("Mat3ColMajor");

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

function formatMat3Error(label: string, detail: string): string {
  return `${label}: expected a length-9 array of finite numbers (${detail})`;
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

function isLength9ArrayLike(x: unknown): x is ArrayLike<unknown> {
  return (
    x !== null &&
    typeof x === "object" &&
    // arrays + typed arrays (DataView is explicitly NOT supported)
    (Array.isArray(x) || isTypedArrayView(x)) &&
    typeof (x as ArrayLike<unknown>).length === "number" &&
    (x as ArrayLike<unknown>).length === 9
  );
}

/**
 * Runtime validation that an input is a length-9 array-like of finite numbers.
 *
 * This is intentionally layout-agnostic; it is used by both row-major and
 * column-major branded types.
 */
export function assertMat3ArrayLike9(value: unknown, options?: { readonly label?: string }): asserts value is ArrayLike<number> {
  const label = options?.label ?? "Mat3";

  if (value instanceof DataView) {
    throw new Error(`${label}: DataView is not a supported Mat3 input (use a TypedArray or number[]).`);
  }

  if (!isLength9ArrayLike(value)) {
    throw new Error(formatMat3Error(label, "wrong shape"));
  }

  for (let i = 0; i < 9; i++) {
    const v = value[i];
    if (!isFiniteNumber(v)) {
      throw new Error(formatMat3Error(label, `index ${i} was ${String(v)}`));
    }
  }
}

/**
 * Structural check: accepts number[] and numeric TypedArrays (excludes DataView).
 *
 * This does **not** assert/require that the value is branded as a row/col-major Mat3.
 */
export function isMat3ArrayLike9(value: unknown): value is ArrayLike<number> {
  if (value instanceof DataView) return false;
  if (!isLength9ArrayLike(value)) return false;
  for (let i = 0; i < 9; i++) {
    if (!isFiniteNumber(value[i])) return false;
  }
  return true;
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

/**
 * Validate + brand a value as a row-major Mat3.
 *
 * Used at backend boundaries (node/wasm/fake) to avoid ad-hoc `as Mat3RowMajor`
 * casts.
 */
export function brandMat3RowMajor(value: unknown, options?: BrandMat3Options): Mat3RowMajor {
  const label = options?.label ?? "Mat3RowMajor";
  const freeze = options?.freeze ?? DEFAULT_FREEZE_MODE;

  assertMat3ArrayLike9(value, { label });

  // Always copy to guarantee branding applies to the returned value.
  const arr = Array.from(value);
  tryDefineBrand(arr, MAT3_ROW_MAJOR_BRAND);
  return maybeFreeze(arr, freeze) as unknown as Mat3RowMajor;
}

/**
 * Validate + brand a value as a column-major Mat3.
 */
export function brandMat3ColMajor(value: unknown, options?: BrandMat3Options): Mat3ColMajor {
  const label = options?.label ?? "Mat3ColMajor";
  const freeze = options?.freeze ?? DEFAULT_FREEZE_MODE;

  assertMat3ArrayLike9(value, { label });

  // Always copy to guarantee branding applies to the returned value.
  const arr = Array.from(value);
  tryDefineBrand(arr, MAT3_COL_MAJOR_BRAND);
  return maybeFreeze(arr, freeze) as unknown as Mat3ColMajor;
}

/**
 * Brand-only check: verifies that a value was produced by `brandMat3RowMajor()`.
 */
export function isBrandedMat3RowMajor(value: unknown): value is Mat3RowMajor {
  if (!isLength9ArrayLike(value)) return false;
  return Boolean((value as unknown as Record<symbol, unknown>)[MAT3_ROW_MAJOR_BRAND]);
}

/**
 * Brand-only check: verifies that a value was produced by `brandMat3ColMajor()`.
 */
export function isBrandedMat3ColMajor(value: unknown): value is Mat3ColMajor {
  if (!isLength9ArrayLike(value)) return false;
  return Boolean((value as unknown as Record<symbol, unknown>)[MAT3_COL_MAJOR_BRAND]);
}
