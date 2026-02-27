import { describe, expect, it } from "vitest";

import { spiceClients } from "@rybosome/tspice";

import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

describe("public api smoke", () => {
  it("does not expose internal matrix branding helpers or kernel id list", async () => {
    const mod = await import("@rybosome/tspice");

    expect((mod as any).assertMat3ArrayLike9).toBeUndefined();
    expect((mod as any).isMat3ArrayLike9).toBeUndefined();
    expect((mod as any).brandMat3ColMajor).toBeUndefined();
    expect((mod as any).brandMat3RowMajor).toBeUndefined();
    expect((mod as any).isBrandedMat3ColMajor).toBeUndefined();
    expect((mod as any).isBrandedMat3RowMajor).toBeUndefined();
    expect((mod as any).TSPICE_KERNEL_IDS).toBeUndefined();
  });

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
