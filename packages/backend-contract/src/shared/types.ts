export type KernelSource =
  | string
  | {
      path: string;
      bytes: Uint8Array;
    };

/**
 * Virtual output reference used by writer APIs.
 *
* Lifecycle:
* - A `VirtualOutput` is only guaranteed to be readable via `readVirtualOutput()`
*   **after** the writer handle has been closed (e.g. `spkcls(handle)` for SPKs).
* - Backends may reject reads for outputs they did not create via a writer API.
*   `readVirtualOutput()` is not intended to be a generic filesystem read.
*
* Backend notes:
* - WASM: `path` is treated as a *virtual* identifier under the backend's
*   virtual filesystem (currently rooted at `/kernels`).
* - Node: implementations may stage virtual outputs to a temp file and allow
*   reading bytes back via `readVirtualOutput()`.
 */
export type VirtualOutput = {
  kind: "virtual-output";
  path: string;
};

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

/** Convenience alias for the most common Found payload shape. */
export type FoundValue<T> = Found<{ value: T }>;

export type FoundString = FoundValue<string>;
export type FoundInt = FoundValue<number>;
export type FoundDouble = FoundValue<number>;

/** Extract the payload type of a `Found<...>` result. */
export type FoundPayload<T> = T extends Found<infer P> ? P : never;

export type KernelData = {
  file: string;
  filtyp: string;
  source: string;
  handle: number;
};

/** Result payload for `kinfo()`. */
export type KernelInfo = {
  filtyp: string;
  source: string;
  handle: number;
};

/** SPICE aberration correction string accepted by `spkezr`/`spkpos`. */
export type AbCorr =
  | "NONE"
  | "LT"
  | "LT+S"
  | "CN"
  | "CN+S"
  | "XLT"
  | "XLT+S"
  | "XCN"
  | "XCN+S";

export type SpiceVector3 = [number, number, number];

/**
* A plane encoded as `[normalX, normalY, normalZ, constant]`.
*
* This matches CSPICE's `SpicePlane` ABI layout (`normal[3]` + `constant`).
*/
export type SpicePlane = [number, number, number, number];


// -- Branded handles -------------------------------------------------------

// Type-only brand (no runtime Symbol export).
declare const __spiceHandleBrand: unique symbol;

/** Opaque numeric handle returned by low-level SPICE file APIs (DAF/DAS/DLA). */
export type SpiceHandle = number & { readonly [__spiceHandleBrand]: true };

// -- Branded vector/matrix helpers -----------------------------------------

// Type-only brands (no runtime Symbol export).
declare const __vec3Brand: unique symbol;
export type Vec3 = readonly [number, number, number] & { readonly [__vec3Brand]: true };

// Type-only brands (no runtime Symbol export).
declare const __vec6Brand: unique symbol;
export type Vec6 = readonly [number, number, number, number, number, number] & {
  readonly [__vec6Brand]: true;
};

// -- Fixed-width string helpers ----------------------------------------------

/**
 * A string returned from (or destined for) a fixed-width output buffer of length `Max`.
 *
 * This is a **type-only** brand used for clarity/documentation. It does not perform any
 * runtime validation, and it does not guarantee the string length.
 */
declare const __fixedStringMaxBrand: unique symbol;
export type FixedString<Max extends number> = string & { readonly [__fixedStringMaxBrand]: Max };

/**
 * Result wrapper for APIs that return an array of strings.
 *
 * `truncated` is backend-dependent and should only be set to `true` when the backend can
 * *detect* truncation (for example: when reading fixed-width output buffers).
 */
export interface StringArrayResult {
  values: string[];
  truncated: boolean;
}



// -- Matrix types -----------------------------------------------------------

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

export type SpiceStateVector = [
  number,
  number,
  number,
  number,
  number,
  number,
];

export type SpkezrResult = {
  state: SpiceStateVector;
  lt: number;
};

export type SpkposResult = {
  pos: SpiceVector3;
  lt: number;
};

export type SubPointResult = {
  /** Sub-point on target body surface, expressed in `fixref` at `trgepc`. */
  spoint: SpiceVector3;
  /** Target epoch associated with `spoint`, in seconds past J2000 TDB. */
  trgepc: number;
  /** Vector from observer to `spoint`, expressed in `fixref` at `trgepc`. */
  srfvec: SpiceVector3;
};

export type IluminResult = {
  /** Target epoch associated with `spoint`, in seconds past J2000 TDB. */
  trgepc: number;
  /** Vector from observer to `spoint`, expressed in `fixref` at `trgepc`. */
  srfvec: SpiceVector3;
  /** Phase angle at `spoint`, radians. */
  phase: number;
  /** Solar incidence angle at `spoint`, radians. */
  incdnc: number;
  /** Emission angle at `spoint`, radians. */
  emissn: number;
};

/** Result payload for `illumg()`. */
export type IllumgResult = IluminResult;

/** Result payload for `illumf()`. */
export type IllumfResult = IluminResult & {
  /** True if `spoint` is visible to `obsrvr`. */
  visibl: boolean;
  /** True if `spoint` is lit by `ilusrc`. */
  lit: boolean;
};

/** Result payload for `pl2nvc()`. */
export type Pl2nvcResult = {
  normal: SpiceVector3;
  konst: number;
};
