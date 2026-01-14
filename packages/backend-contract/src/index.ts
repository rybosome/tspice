export const BACKEND_KINDS = ["node", "wasm"] as const;

export type BackendKind = (typeof BACKEND_KINDS)[number];

export interface SpiceBackend {
  kind: BackendKind;
  spiceVersion(): string;
}
