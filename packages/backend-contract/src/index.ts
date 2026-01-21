export const BACKEND_KINDS = ["node", "wasm"] as const;

export type BackendKind = (typeof BACKEND_KINDS)[number];

export interface SpiceBackend {
  kind: BackendKind;
  spiceVersion(): string;

  /**
   * Thin wrapper over the SPICE primitive `tkvrsn()`.
   *
   * Phase 1: only the TOOLKIT item is required.
   */
  tkvrsn(item: "TOOLKIT"): string;
}
