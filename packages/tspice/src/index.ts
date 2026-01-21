import type { BackendKind, SpiceBackend } from "@rybosome/tspice-backend-contract";
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
      try {
        // Keep this import non-static so JS-only CI can run without building
        // the native backend package.
        const nodeBackendSpecifier = "@rybosome/tspice-backend-" + "node";
        const { createNodeBackend } = (await import(
          nodeBackendSpecifier
        )) as {
          createNodeBackend: () => SpiceBackend;
        };
        return createNodeBackend();
      } catch (error) {
        throw new Error(
          `Failed to load @rybosome/tspice-backend-node (required for backend=\"node\"): ${String(error)}`,
        );
      }
    case "wasm":
      if (options.wasmUrl === undefined) {
        return await createWasmBackend();
      }
      return await createWasmBackend({ wasmUrl: options.wasmUrl });
    default:
      return assertNever(backend, "Unsupported backend");
  }
}
