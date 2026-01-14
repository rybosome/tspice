import type { SpiceBackend } from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import { getNativeAddon } from "./native.js";

export function spiceVersion(): string {
  const version = getNativeAddon().spiceVersion();
  invariant(typeof version === "string");
  return version;
}

export function createNodeBackend(): SpiceBackend {
  return {
    kind: "node",
    spiceVersion
  };
}
