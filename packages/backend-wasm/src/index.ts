import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

export type { CreateWasmBackendOptions } from "./runtime/create-backend-options.js";
import type { CreateWasmBackendOptions } from "./runtime/create-backend-options.js";

// NOTE: Runtime selection is handled by `package.json` conditional exports.
// This entrypoint exists to provide a stable, environment-agnostic type surface
// for TypeScript (which does not currently select types per condition).

export declare const WASM_BINARY_FILENAME: "tspice_backend_wasm.wasm";

// This differs between Node and Web builds.
export declare const WASM_JS_FILENAME: string;

export declare function createWasmBackend(
  options?: CreateWasmBackendOptions,
): Promise<SpiceBackend & { kind: "wasm" }>;
