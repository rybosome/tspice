/** Kernel types used by summary/introspection APIs. */
export type KernelKind =
  | "ALL"
  | "SPK"
  | "CK"
  | "PCK"
  | "DSK"
  | "TEXT"
  | "LSK"
  | "FK"
  | "IK"
  | "SCLK"
  | "EK"
  | "META";

/**
 * Kernel kind selector used by `ktotal()` / `kdata()`.
 *
 * Supports:
 * - a single `KernelKind`
 * - an array of `KernelKind` (treated as an OR query)
 * - a CSPICE-style multi-kind string (whitespace-separated, e.g. `"SPK CK"`)
 */
export type KernelKindInput = KernelKind | readonly KernelKind[] | string;

/**
 * Optional-return convention for lookups where "not found" is a normal outcome.
 *
 * Conventions:
 * - Return `{ found: false }` when the underlying value simply doesn't exist
 *   (e.g. name-to-code lookups for names that aren't present in loaded kernels).
 * - Throw for invalid arguments, SPICE errors, and other exceptional failures.
 * - When `found: true`, extra fields are present on the returned object.
 */
export type Found<T> =
  | {
      found: false;
    }
  | ({ found: true } & T);

export type KernelData = {
  file: string;
  filtyp: string;
  source: string;
  handle: number;
};

// -- Branded handles -------------------------------------------------------

// Type-only brand (no runtime Symbol export).
declare const __spiceHandleBrand: unique symbol;

/** Opaque numeric handle returned by low-level SPICE file APIs (DAF/DAS/DLA). */
export type SpiceHandle = number & { readonly [__spiceHandleBrand]: true };

export type SpiceHandleKind = "DAF" | "DAS" | "DLA" | "SPK" | "EK";

export type SpiceHandleEntry = {
  kind: SpiceHandleKind;
  nativeHandle: number;
};

export type SpiceHandleRegistry = {
  register: (kind: SpiceHandleKind, nativeHandle: number) => SpiceHandle;
  lookup: (handle: SpiceHandle, expected: readonly SpiceHandleKind[], context: string) => SpiceHandleEntry;
  close: (
    handle: SpiceHandle,
    expected: readonly SpiceHandleKind[],
    closeNative: (entry: SpiceHandleEntry) => void,
    context: string,
  ) => void;
  size: () => number;
};

// -- Branded vector/matrix helpers -----------------------------------------

// Type-only brands (no runtime Symbol export).
declare const __vec3Brand: unique symbol;
export type Vec3 = readonly [number, number, number] & { readonly [__vec3Brand]: true };

// Type-only brands (no runtime Symbol export).
declare const __vec6Brand: unique symbol;
export type Vec6 = readonly [number, number, number, number, number, number] & {
  readonly [__vec6Brand]: true;
};

/**
 * 3x3 matrix encoded as a length-9 array in **row-major** order.
 *
 * Row-major layout: `[m00,m01,m02, m10,m11,m12, m20,m21,m22]`.
 */
// Type-only brand (no runtime Symbol export).
declare const __mat3RowMajorBrand: unique symbol;
export type Mat3RowMajor = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
] & { readonly [__mat3RowMajorBrand]: true };

/**
 * 3x3 matrix encoded as a length-9 array in **column-major** order.
 *
 * Column-major layout: `[m00,m10,m20, m01,m11,m21, m02,m12,m22]`.
 */
// Type-only brand (no runtime Symbol export).
declare const __mat3ColMajorBrand: unique symbol;
export type Mat3ColMajor = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
] & { readonly [__mat3ColMajorBrand]: true };

export type SpiceMatrix6x6 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * 6x6 matrix encoded as a length-36 array in **row-major** order.
 *
 * Row-major layout: `[m00,m01,...,m05, m10,m11,...,m15, ..., m50,...,m55]`.
 */
// Type-only brand (no runtime Symbol export).
declare const __mat6RowMajorBrand: unique symbol;
export type Mat6RowMajor = Readonly<SpiceMatrix6x6> & { readonly [__mat6RowMajorBrand]: true };
