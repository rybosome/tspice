import { describe, expect, it } from "vitest";

import { spiceClients } from "@rybosome/tspice";
import { tkvrsnToolkitE2e } from "./e2e/tkvrsn.js";

describe("@rybosome/tspice", () => {
  it("defaults to the WASM backend when no opts are provided", async () => {
    const { spice, dispose } = await spiceClients.toSync();
    try {
      expect(spice.raw.kind).toBe("wasm");
      expect(spice.kit.toolkitVersion()).toBeTypeOf("string");
    } finally {
      await dispose();
    }
  });

  it("supports calling toolkitVersion() end-to-end via WASM", async () => {
    const version = await tkvrsnToolkitE2e({ backend: "wasm" });
    expect(version).toBeTypeOf("string");
    expect(version).not.toBe("");
  });
});
