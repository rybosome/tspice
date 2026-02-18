import { describe, expect, it } from "vitest";

import { spiceClients } from "@rybosome/tspice";

import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

describe("public api smoke", () => {
  it("can import @rybosome/tspice and build a sync wasm client", async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });

    try {
      // Should work with no kernels loaded.
      const version = spice.kit.toolkitVersion();
      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
    } finally {
      await dispose();
    }
  });

  const itNode = it.runIf(nodeBackendAvailable);

  itNode("can import @rybosome/tspice and build a sync node client", async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend: "node" });

    try {
      const version = spice.kit.toolkitVersion();
      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
    } finally {
      await dispose();
    }
  });
});
