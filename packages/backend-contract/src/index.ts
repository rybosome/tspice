export const BACKEND_KINDS = ["node", "wasm"] as const;
export type BackendKind = (typeof BACKEND_KINDS)[number];

/** A 3D vector. */
export type Vector3 = readonly [number, number, number];

/** A 6-element state vector (position [km] + velocity [km/s]). */
export type State6 = readonly [number, number, number, number, number, number];

/** 3x3 matrix, row-major, flat length 9. */
export type Matrix3 = readonly [
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

/** 6x6 matrix, row-major, flat length 36. */
export type Matrix6 = readonly [
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
 * "Not found" wrapper used instead of returning `null`.
 *
 * Example:
 * - `{ found: false }`
 * - `{ found: true, name: "EARTH" }`
 */
export type Found<T extends object> = { found: false } | ({ found: true } & T);

/** SPICE aberration correction flags. */
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

/** Formats accepted by `et2utc`. */
export type Et2UtcFormat = "C" | "D" | "J" | "ISOC" | "ISOD";

/**
 * Shared backend contract.
 *
 * NOTE: Some methods may be unimplemented in early PRs; backends are allowed
 * to throw `Error("Not implemented yet")` until subsequent PRs provide real
 * implementations.
 */
export interface SpiceBackend {
  kind: BackendKind;

  // ---- Phase 0 / plumbing
  spiceVersion(): string;

  // ---- Phase 1: kernels + time
  furnsh(path: string): void;
  unload(path: string): void;
  kclear(): void;

  ktotal(kind?: KernelKind): number;
  kdata(
    which: number,
    kind?: KernelKind,
  ): Found<{ file: string; filtyp: string; source: string; handle: number }>;

  str2et(utc: string): number;
  et2utc(et: number, format: Et2UtcFormat, prec: number): string;

  /**
   * Format an ephemeris time using a NAIF time picture.
   *
   * Wrapper around CSPICE `timout_c`.
   */
  timout(et: number, picture: string): string;

  // ---- Phase 2: IDs / names
  bodn2c(name: string): Found<{ code: number }>;
  bodc2n(code: number): Found<{ name: string }>;

  namfrm(frameName: string): Found<{ frameId: number }>;
  frmnam(frameId: number): Found<{ frameName: string }>;

  // ---- Phase 3: geometry / transforms
  spkezr(
    target: string,
    et: number,
    ref: string,
    abcorr: AbCorr,
    obs: string,
  ): { state: State6; lt: number };

  pxform(from: string, to: string, et: number): Matrix3;
  sxform(from: string, to: string, et: number): Matrix6;
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

  /** Load a kernel that already exists in the WASM filesystem. */
  loadKernel(path: string, data: Uint8Array): void;
}
