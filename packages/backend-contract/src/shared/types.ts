export type KernelSource =
  | string
  | {
      path: string;
      bytes: Uint8Array;
    };

/** Kernel types used by summary/introspection APIs. */
export type KernelKind =
  | "ALL"
  | "SPK"
  | "CK"
  | "PCK"
  | "LSK"
  | "FK"
  | "IK"
  | "SCLK"
  | "EK"
  | "META";

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


// -- Matrix types -----------------------------------------------------------

/**
 * 3x3 matrix encoded as a length-9 array in **row-major** order.
 *
 * Row-major layout: `[m00,m01,m02, m10,m11,m12, m20,m21,m22]`.
 */
declare const __mat3RowMajorBrand: unique symbol;
export type Mat3RowMajor = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
] & { readonly [__mat3RowMajorBrand]: "Mat3RowMajor" };

/**
 * 3x3 matrix encoded as a length-9 array in **column-major** order.
 *
 * Column-major layout: `[m00,m10,m20, m01,m11,m21, m02,m12,m22]`.
 */
declare const __mat3ColMajorBrand: unique symbol;
export type Mat3ColMajor = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
] & { readonly [__mat3ColMajorBrand]: "Mat3ColMajor" };


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
