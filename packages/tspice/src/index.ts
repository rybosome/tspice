import type { BackendKind, SpiceBackend } from "@rybosome/tspice-backend-contract";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

export type { BackendKind, SpiceBackend } from "@rybosome/tspice-backend-contract";

export type CreateBackendOptions = {
  backend?: BackendKind;
};

export function createBackend(options: CreateBackendOptions = {}): SpiceBackend {
  const backend = options.backend ?? "node";

  switch (backend) {
    case "node":
      return createNodeBackend();
    case "wasm":
      return createWasmBackend();
  }
}
