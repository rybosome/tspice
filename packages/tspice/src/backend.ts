import type { SpiceBackend } from "@rybosome/tspice-backend-contract";
import { assertNever } from "@rybosome/tspice-core";

export type { SpiceBackend } from "@rybosome/tspice-backend-contract";

export type BackendKind = "node" | "wasm";

export type SpiceBackendWithKind<K extends BackendKind = BackendKind> = SpiceBackend & {
  /**
   * Which backend implementation is in use.
   *
   * Note: this is added by `@rybosome/tspice`'s `createBackend()` wrapper; it is
   * not part of `@rybosome/tspice-backend-contract`.
   */
  kind: K;
};

export type CreateBackendOptions = {
  /**
   * Explicitly select a backend implementation.
   */
  backend: BackendKind;
  wasmUrl?: string | URL;
};

export function createBackend(options: {
  backend: "wasm";
  wasmUrl?: string | URL;
}): Promise<SpiceBackendWithKind<"wasm">>;
export function createBackend(options: { backend: "node" }): Promise<SpiceBackendWithKind<"node">>;
export function createBackend(options: CreateBackendOptions): Promise<SpiceBackendWithKind>;
export async function createBackend(options: CreateBackendOptions): Promise<SpiceBackendWithKind> {
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

        const instance = createNodeBackend() as SpiceBackendWithKind<"node">;
        // Avoid object spreading so we preserve the backend object's identity
        // (and any internal symbols / non-enumerable props).
        (instance as unknown as { kind: "node" }).kind = "node";
        return instance;
      } catch (error) {
        throw new Error(
          `Failed to load native backend (required for backend="node"): ${String(error)}`,
        );
      }

    case "wasm":
      try {
        const { createWasmBackend } = (await import("@rybosome/tspice-backend-wasm")) as {
          createWasmBackend: (opts?: { wasmUrl?: string | URL }) => Promise<SpiceBackend>;
        };

        const instance = (await createWasmBackend(
          opts.wasmUrl === undefined ? undefined : { wasmUrl: opts.wasmUrl },
        )) as SpiceBackendWithKind<"wasm">;

        (instance as unknown as { kind: "wasm" }).kind = "wasm";
        return instance;
      } catch (error) {
        throw new Error(
          `Failed to load WASM backend (required for backend="wasm"): ${String(error)}`,
        );
      }

    default:
      return assertNever(backend, "Unsupported backend");
  }
}
