import type { KernelSource, SpiceBackend, SpiceCharCell, SpiceDoubleCell, SpiceIntCell, SpiceWindow, VirtualOutput } from "@rybosome/tspice-backend-contract";

import type {
  AberrationCorrection,
  FrameName,
  GetStateArgs,
  SpiceTime,
  StateVector,
} from "../../types.js";
import type { Mat3 } from "../math/mat3.js";

/**
 * Higher-level helpers and convenience APIs built on top of the raw backend.
 */
export interface SpiceKit {
  /** Load a SPICE kernel. */
  loadKernel(kernel: KernelSource): void;
  /** Unload a previously-loaded SPICE kernel. */
  unloadKernel(path: string): void;
  /** Clear all loaded kernels (mirrors `raw.kclear()`), and resets kit tracking. */
  kclear(): void;

  /** Convenience wrapper around `tkvrsn(\"TOOLKIT\")`. */
  spiceVersion(): string;

  /** Convenience wrapper around `tkvrsn(\"TOOLKIT\")`. */
  toolkitVersion(): string;

  /** Read bytes from a backend-managed virtual output file. */
  readVirtualOutput(output: VirtualOutput): Uint8Array;

  /** Convert UTC time string to ET seconds past J2000. */
  utcToEt(utc: string): SpiceTime;
  /** Convert ET seconds past J2000 to a formatted UTC string. */
  etToUtc(et: SpiceTime, format?: string, prec?: number): string;

  /** Compute a 3x3 frame transformation matrix. */
  frameTransform(from: FrameName, to: FrameName, et: SpiceTime): Mat3;

  /** Convenience wrapper around `spkezr` that returns a structured state vector. */
  getState(args: GetStateArgs): StateVector;

  /** Create an empty integer set cell with the given capacity. */
  newIntCell(size: number): SpiceIntCell;

  /** Create an empty double-precision set cell with the given capacity. */
  newDoubleCell(size: number): SpiceDoubleCell;

  /**
   * Create an empty character set cell.
   *
   * `length` is the maximum string length (including trailing NUL). CSPICE
   * generally expects `length >= 2` and recommends `length >= 5`.
   */
  newCharCell(size: number, length: number): SpiceCharCell;

  /** Create an empty DP window with capacity for `maxIntervals` intervals. */
  newWindow(maxIntervals: number): SpiceWindow;

  /** Free a previously-created cell handle. */
  freeCell(cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell): void;

  /** Free a previously-created window handle. */
  freeWindow(window: SpiceWindow): void;

  // -- Cell element inspection (copies, no raw data views) -------------------

  /**
   * Element inspection helpers.
   *
   * Notes:
   * - These methods **copy** data out of the underlying cell.
   * - They are not intended as a high-performance bulk read API.
   */

  /** Fetch the `index`th element of an integer cell. */
  cellGeti(cell: SpiceIntCell, index: number): number;

  /** Fetch the `index`th element of a double cell. */
  cellGetd(cell: SpiceDoubleCell, index: number): number;

  /**
   * Fetch the `index`th element of a character cell.
   *
   * Backends may right-trim whitespace to match common CSPICE string handling.
   */
  cellGetc(cell: SpiceCharCell, index: number): string;
};

export type PromisifyFn<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => Promise<Awaited<R>>
  : T;

export type PromisifyObject<T extends object> = {
  [K in keyof T]: PromisifyFn<T[K]>;
};

/** Raw tspice surface: backend raw primitives (minus kit-moved helpers) plus backend metadata. */
export type SpiceRaw = SpiceBackend["raw"] & Pick<SpiceBackend, "kind">;

/**
 * Top-level sync-ish client type (returned by `spiceClients.toSync()`).
 */
export type Spice = {
  /** Raw backend primitives (verbatim). */
  raw: SpiceRaw;
  /** Higher-level helpers and typed conveniences. */
  kit: SpiceKit;
};

/**
 * Sync-ish client returned by `spiceClients.toSync()`.
 */
export type SpiceSync = Spice;

/**
 * Async client returned by `spiceClients.toAsync()` / `spiceClients.toWebWorker()`.
 *
 * Mirrors the sync surface area, but wraps every function in a `Promise`.
 */
export type SpiceAsync = {
  raw: PromisifyObject<SpiceRaw>;
  kit: PromisifyObject<SpiceKit>;
};
