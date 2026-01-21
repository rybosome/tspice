import type { KernelSource, SpiceBackend } from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import { getNativeAddon } from "./native.js";

export function spiceVersion(): string {
  const version = getNativeAddon().spiceVersion();
  invariant(typeof version === "string", "Expected native backend spiceVersion() to return a string");
  return version;
}

export function createNodeBackend(): SpiceBackend {
  return {
    kind: "node",
    spiceVersion,
    furnsh: (_kernel: KernelSource) => {
      throw new Error("Node backend kernel loading is not implemented yet");
    },
    unload: (_path: string) => {
      throw new Error("Node backend kernel unloading is not implemented yet");
    },
    tkvrsn: (item) => {
      invariant(item === "TOOLKIT", `Unsupported tkvrsn item: ${item}`);
      return spiceVersion();
    }
  };
}
