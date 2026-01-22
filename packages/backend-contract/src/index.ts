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

  namfrm(name: string): Found<{ code: number }>;
  frmnam(code: number): Found<{ name: string }>;

  cidfrm(center: number): Found<{ frcode: number; frname: string }>;
  cnmfrm(centerName: string): Found<{ frcode: number; frname: string }>;

  // ---- Phase 2: SCLK + CK attitude
  /** Convert an encoded SCLK string to ephemeris time. */
  scs2e(sc: number, sclkch: string): number;

  /** Convert ephemeris time to an encoded SCLK string. */
  sce2s(sc: number, et: number): string;

  /**
   * Get pointing (attitude) for a CK instrument at a given encoded spacecraft clock time.
   */
  ckgp(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): Found<{ cmat: Matrix3; clkout: number }>;

  /**
   * Get pointing + angular velocity for a CK instrument at a given encoded spacecraft clock time.
   */
  ckgpav(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): Found<{ cmat: Matrix3; av: Vector3; clkout: number }>;

  // ---- Phase 3: geometry / transforms
  spkezr(
    target: string,
    et: number,
    ref: string,
    abcorr: AbCorr,
    obs: string,
  ): { state: State6; lt: number };

  spkpos(
    target: string,
    et: number,
    ref: string,
    abcorr: AbCorr,
    obs: string,
  ): { pos: Vector3; lt: number };

  pxform(from: string, to: string, et: number): Matrix3;
  sxform(from: string, to: string, et: number): Matrix6;

  // ---- Phase 3: coordinate conversions + small vector/matrix helpers
  reclat(rect: Vector3): { radius: number; lon: number; lat: number };
  latrec(radius: number, lon: number, lat: number): Vector3;

  recsph(rect: Vector3): { radius: number; colat: number; lon: number };
  sphrec(radius: number, colat: number, lon: number): Vector3;

  vnorm(v: Vector3): number;
  vhat(v: Vector3): Vector3;
  vdot(a: Vector3, b: Vector3): number;
  vcrss(a: Vector3, b: Vector3): Vector3;

  mxv(m: Matrix3, v: Vector3): Vector3;
  mtxv(m: Matrix3, v: Vector3): Vector3;
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
