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

  namfrm(frameName: string): Found<{ frameId: number }>;
  frmnam(frameId: number): Found<{ frameName: string }>;

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
