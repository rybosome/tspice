export const BACKEND_KINDS = ["node", "wasm"] as const;

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

export interface SpiceBackend {
  kind: BackendKind;
  spiceVersion(): string;

  /**
   * Load a SPICE kernel.
   *
   * - If a string is provided, it is treated as a filesystem path.
   * - If bytes are provided, the backend may write them to a virtual filesystem
   *   at `path` before calling into SPICE.
   */
  furnsh(kernel: KernelSource): void;

  /**
   * Unload a SPICE kernel previously loaded via `furnsh()`.
   */
  unload(path: string): void;

  /** Clear all loaded kernels. */
  kclear(): void;

  /** Count loaded kernels of a given kind. */
  ktotal(kind?: KernelKind): number;

  /** Retrieve kernel metadata at position `which` for a given kind. */
  kdata(which: number, kind?: KernelKind): Found<KernelData>;

  /**
   * Thin wrapper over the SPICE primitive `tkvrsn()`.
   *
   * Phase 1: only the TOOLKIT item is required.
   */
  tkvrsn(item: "TOOLKIT"): string;

  // --- Phase 3 low-level primitives ---

  /** Convert a time string to ET seconds past J2000. */
  str2et(time: string): number;

  /** Convert ET seconds past J2000 to a formatted UTC string. */
  et2utc(et: number, format: string, prec: number): string;

  /**
   * Format an ephemeris time using a NAIF time picture.
   *
   * Wrapper around CSPICE `timout_c`.
   */
  timout(et: number, picture: string): string;

  // --- Phase 4 IDs / names ---

  bodn2c(name: string): Found<{ code: number }>;
  bodc2n(code: number): Found<{ name: string }>;

  namfrm(name: string): Found<{ code: number }>;
  frmnam(code: number): Found<{ name: string }>;

  cidfrm(center: number): Found<{ frcode: number; frname: string }>;
  cnmfrm(centerName: string): Found<{ frcode: number; frname: string }>;

  // --- Phase 5 SCLK conversions + CK attitude ---

  /** Convert an encoded SCLK string to ET seconds past J2000. */
  scs2e(sc: number, sclkch: string): number;

  /** Convert ET seconds past J2000 to an encoded SCLK string. */
  sce2s(sc: number, et: number): string;

  /** Get pointing (attitude) for a CK instrument at a given encoded spacecraft clock time. */
  ckgp(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): Found<{ cmat: SpiceMatrix3x3; clkout: number }>;

  /** Get pointing + angular velocity for a CK instrument at a given encoded spacecraft clock time. */
  ckgpav(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): Found<{ cmat: SpiceMatrix3x3; av: SpiceVector3; clkout: number }>;

  /** Compute a 3x3 frame transformation matrix (row-major). */
  pxform(from: string, to: string, et: number): SpiceMatrix3x3;

  /** Compute a 6x6 state transformation matrix (row-major). */
  sxform(from: string, to: string, et: number): SpiceMatrix6x6;

  /** Compute state (6-vector) and light time via `spkezr`. */
  spkezr(
    target: string,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SpkezrResult;

  /** Compute position (3-vector) and light time via `spkpos`. */
  spkpos(
    target: string,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SpkposResult;

  // --- Derived geometry primitives ---

  /** Compute the sub-observer point on a target body's surface. */
  subpnt(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SubPointResult;

  /** Compute the sub-solar point on a target body's surface. */
  subslr(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SubPointResult;

  /** Compute the surface intercept point of a ray. */
  sincpt(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    observer: string,
    dref: string,
    dvec: SpiceVector3,
  ): Found<SubPointResult>;

  /** Compute illumination angles at a surface point. */
  ilumin(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    observer: string,
    spoint: SpiceVector3,
  ): IluminResult;

  /** Determine the occultation condition code for one target vs another. */
  occult(
    targ1: string,
    shape1: string,
    frame1: string,
    targ2: string,
    shape2: string,
    frame2: string,
    abcorr: AbCorr | string,
    observer: string,
    et: number,
  ): number;

  // --- Phase 6: coordinate conversions + small vector/matrix helpers ---

  reclat(rect: SpiceVector3): { radius: number; lon: number; lat: number };
  latrec(radius: number, lon: number, lat: number): SpiceVector3;

  recsph(rect: SpiceVector3): { radius: number; colat: number; lon: number };
  sphrec(radius: number, colat: number, lon: number): SpiceVector3;

  vnorm(v: SpiceVector3): number;

  /**
   * Compute the unit vector of `v`.
   *
   * **Zero-vector behavior:** if `v` is `[0, 0, 0]`, this returns `[0, 0, 0]` and
   * does **not** throw.
   *
   * This matches the NAIF CSPICE `vhat_c` definition.
   */
  vhat(v: SpiceVector3): SpiceVector3;
  vdot(a: SpiceVector3, b: SpiceVector3): number;
  vcrss(a: SpiceVector3, b: SpiceVector3): SpiceVector3;

  mxv(m: SpiceMatrix3x3, v: SpiceVector3): SpiceVector3;
  mtxv(m: SpiceMatrix3x3, v: SpiceVector3): SpiceVector3;
}

/**
* WASM-only helpers (not available on the node backend).
*
* These are used to populate the in-memory FS and then load kernels.
*/
export interface SpiceBackendWasm extends SpiceBackend {
  kind: "wasm";

  /** Write a file into the WASM in-memory filesystem. */
  writeFile(path: string, data: Uint8Array): void;

  /** Write and load a kernel into the WASM filesystem. */
  loadKernel(path: string, data: Uint8Array): void;
}
