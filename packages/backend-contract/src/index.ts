export const BACKEND_KINDS = ["node", "wasm"] as const;

export type BackendKind = (typeof BACKEND_KINDS)[number];

export type KernelSource =
  | string
  | {
      path: string;
      bytes: Uint8Array;
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
}
