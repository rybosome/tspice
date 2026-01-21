import type { BackendKind, SpiceBackend } from "@rybosome/tspice-backend-contract";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { createWasmBackend } from "@rybosome/tspice-backend-wasm";
import { assertNever } from "@rybosome/tspice-core";

export type { BackendKind, SpiceBackend } from "@rybosome/tspice-backend-contract";

export type CreateBackendOptions = {
  backend?: BackendKind;
  wasmUrl?: string | URL;
};

export async function createBackend(
  options: CreateBackendOptions = {},
): Promise<SpiceBackend> {
  const backend = options.backend ?? "wasm";

  switch (backend) {
    case "node":
      return createNodeBackend();
    case "wasm":
      if (options.wasmUrl === undefined) {
        return await createWasmBackend();
      }
      return await createWasmBackend({ wasmUrl: options.wasmUrl });
    default:
      return assertNever(backend, "Unsupported backend");
  }
}
