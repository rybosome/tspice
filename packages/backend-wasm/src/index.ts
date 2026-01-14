import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

export function createWasmBackend(): SpiceBackend {
  return {
    kind: "wasm",
    spiceVersion: () => "wasm-stub"
  };
}
