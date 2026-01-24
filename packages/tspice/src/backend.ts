import type {
  BackendKind,
  SpiceBackend,
  SpiceBackendWasm,
} from "@rybosome/tspice-backend-contract";
import { assertNever } from "@rybosome/tspice-core";

export type { BackendKind, SpiceBackend, SpiceBackendWasm } from "@rybosome/tspice-backend-contract";

export type CreateBackendOptions = {
  backend?: BackendKind;
  wasmUrl?: string | URL;
};

export function createBackend(): Promise<SpiceBackendWasm>;
export function createBackend(options?: { backend?: "wasm"; wasmUrl?: string | URL }): Promise<SpiceBackendWasm>;
export function createBackend(options: { backend: "node" }): Promise<SpiceBackend>;
export function createBackend(options: { backend: "fake" }): Promise<SpiceBackend>;
export function createBackend(options: CreateBackendOptions): Promise<SpiceBackend | SpiceBackendWasm>;
export async function createBackend(
  options: CreateBackendOptions = {},
): Promise<SpiceBackend | SpiceBackendWasm> {
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
      try {
        const { createWasmBackend } = (await import(
          "@rybosome/tspice-backend-wasm"
        )) as {
          createWasmBackend: (opts?: { wasmUrl?: string | URL }) => Promise<SpiceBackendWasm>;
        };

        if (options.wasmUrl === undefined) {
          return await createWasmBackend();
        }
        return await createWasmBackend({ wasmUrl: options.wasmUrl });
      } catch (error) {
        throw new Error(
          `Failed to load @rybosome/tspice-backend-wasm (required for backend=\"wasm\"): ${String(error)}`,
        );
      }
    case "fake":
      try {
        const { createFakeBackend } = (await import(
          "@rybosome/tspice-backend-fake"
        )) as {
          createFakeBackend: () => SpiceBackend;
        };
        return createFakeBackend();
      } catch (error) {
        throw new Error(
          `Failed to load @rybosome/tspice-backend-fake (required for backend=\"fake\"): ${String(error)}`,
        );
      }
    default:
      return assertNever(backend, "Unsupported backend");
  }
}
