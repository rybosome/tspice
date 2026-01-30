import type { SpiceBackendWasm } from "@rybosome/tspice-backend-contract";

// This file exists solely to provide a stable, environment-agnostic TypeScript
// surface for the package root. Runtime selection is handled by conditional
// exports (`index.node.js` vs `index.web.js`).

export type CreateWasmBackendOptions = {
  wasmUrl?: string | URL;
};

export declare const WASM_BINARY_FILENAME: "tspice_backend_wasm.wasm";
export declare const WASM_JS_FILENAME: string;

export declare function createWasmBackend(
  options?: CreateWasmBackendOptions,
): Promise<SpiceBackendWasm>;
