export const BACKEND_KINDS = ["node", "wasm"] as const;

export type BackendKind = (typeof BACKEND_KINDS)[number];

export type KernelSource =
  | string
  | {
      path: string;
      bytes: Uint8Array;
    };

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

  /** Compute a 3x3 frame transformation matrix (row-major). */
  pxform(from: string, to: string, et: number): SpiceMatrix3x3;

  /** Compute state (6-vector) and light time via `spkezr`. */
  spkezr(
    target: string,
    et: number,
    ref: string,
    abcorr: string,
    observer: string,
  ): SpkezrResult;
}
