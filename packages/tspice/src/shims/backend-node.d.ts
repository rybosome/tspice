declare module "@rybosome/tspice-backend-node" {
  import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

  export function createNodeBackend(): SpiceBackend;
}
