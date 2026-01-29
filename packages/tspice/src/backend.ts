import type {
  BackendKind,
  SpiceBackend,
  SpiceBackendWasm,
} from "@rybosome/tspice-backend-contract";
import { assertNever } from "@rybosome/tspice-core";

export type { BackendKind, SpiceBackend, SpiceBackendWasm } from "@rybosome/tspice-backend-contract";

export type CreateBackendOptions = {
  /**
   * Explicitly select a backend implementation.
   */
  backend: "node" | "wasm";
  wasmUrl?: string | URL;
};

export function createBackend(options: { backend: "wasm"; wasmUrl?: string | URL }): Promise<SpiceBackendWasm>;
export function createBackend(options: { backend: "node" }): Promise<SpiceBackend>;
export function createBackend(options: CreateBackendOptions): Promise<SpiceBackend | SpiceBackendWasm>;
export async function createBackend(options: CreateBackendOptions): Promise<SpiceBackend | SpiceBackendWasm> {
  // Runtime validation for JS callers; TypeScript callers should already be
  // forced to provide an explicit backend selection.
  const opts = options as unknown as CreateBackendOptions | undefined;

  if (opts === undefined || (opts as unknown as { backend?: unknown }).backend === undefined) {
    throw new Error(
      'createBackend() requires an explicit backend selection: { backend: "node" } or { backend: "wasm" }',
    );
  }

  const backend = opts.backend;

  switch (backend) {
    case "node":
      try {
        // Keep this import non-static so JS-only CI can run without building
        // the native backend package.
        const nodeBackendSpecifier = "@rybosome/tspice-backend-" + "node";
        const { createNodeBackend } = (await import(nodeBackendSpecifier)) as {
          createNodeBackend: () => SpiceBackend;
        };
        return createNodeBackend();
      } catch (error) {
        throw new Error(
          `Failed to load native backend (required for backend=\"node\"): ${String(error)}`,
        );
      }
    case "wasm":
      try {
        const { createWasmBackend } = (await import(
          "@rybosome/tspice-backend-wasm"
        )) as {
          createWasmBackend: (opts?: { wasmUrl?: string | URL }) => Promise<SpiceBackendWasm>;
        };

        if (opts.wasmUrl === undefined) {
          return await createWasmBackend();
        }
        return await createWasmBackend({ wasmUrl: opts.wasmUrl });
      } catch (error) {
        throw new Error(
          `Failed to load WASM backend (required for backend=\"wasm\"): ${String(error)}`,
        );
      }
    default:
      return assertNever(backend, "Unsupported backend");
  }
}
