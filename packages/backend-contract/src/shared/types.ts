export const BACKEND_KINDS = ["node", "wasm", "fake"] as const;

export type BackendKind = (typeof BACKEND_KINDS)[number];

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

export type SpiceMatrix3x3 = [
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
