import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";
import { tkvrsnToolkitE2e } from "./e2e/tkvrsn.js";

describe("@rybosome/tspice", () => {
  it("requires explicit backend selection", async () => {
    // @ts-expect-error - runtime validation for JS callers
    await expect(createBackend()).rejects.toThrow(/explicit backend selection/i);
  });

  it("supports calling tkvrsn(\"TOOLKIT\") end-to-end via WASM", async () => {
    const version = await tkvrsnToolkitE2e({ backend: "wasm" });
    expect(version).toBeTypeOf("string");
    expect(version).not.toBe("");
  });
});
