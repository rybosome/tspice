import type {
  BackendKind,
  SpiceBackend,
  SpiceBackendWasm,
} from "@rybosome/tspice-backend-contract";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { createWasmBackend } from "@rybosome/tspice-backend-wasm";
import { assertNever } from "@rybosome/tspice-core";

export type {
  BackendKind,
  SpiceBackend,
  SpiceBackendWasm,
} from "@rybosome/tspice-backend-contract";

export type CreateBackendOptions = {
  backend?: BackendKind;
  wasmUrl?: string | URL;
};

export function createBackend(options?: { backend?: "node" }): Promise<SpiceBackend>;
export function createBackend(
  options: { backend: "wasm"; wasmUrl?: string | URL },
): Promise<SpiceBackendWasm>;
export async function createBackend(
  options: CreateBackendOptions = {},
): Promise<SpiceBackend | SpiceBackendWasm> {
  const backend = options.backend ?? "node";

  switch (backend) {
    case "node":
      return createNodeBackend();
    case "wasm":
      if (options.wasmUrl === undefined) {
        return (await createWasmBackend()) as SpiceBackendWasm;
      }
      return (await createWasmBackend({ wasmUrl: options.wasmUrl })) as SpiceBackendWasm;
    default:
      return assertNever(backend, "Unsupported backend");
  }
}
