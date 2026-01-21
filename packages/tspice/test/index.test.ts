import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";
import { tkvrsnToolkitE2e } from "./e2e/tkvrsn.js";

describe("@rybosome/tspice", () => {
  it("defaults to wasm backend", async () => {
    const backend = await createBackend();
    expect(backend.kind).toBe("wasm");
  });

  it("supports calling tkvrsn(\"TOOLKIT\") end-to-end via WASM", async () => {
    const version = await tkvrsnToolkitE2e({ backend: "wasm" });
    expect(version).toBeTypeOf("string");
    expect(version).not.toBe("");
  });
});
