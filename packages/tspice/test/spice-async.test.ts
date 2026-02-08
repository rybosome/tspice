import { describe, expect, it } from "vitest";

import { createSpice, createSpiceAsync } from "@rybosome/tspice";

describe("createSpiceAsync()", () => {
  it("returns { raw, kit } and makes methods awaitable", async () => {
    const spice = await createSpiceAsync({ backend: "wasm" });

    expect(spice).toHaveProperty("raw");
    expect(spice).toHaveProperty("kit");
    expect((spice as any).furnsh).toBeUndefined();
    expect((spice as any).loadKernel).toBeUndefined();

    // Non-function properties should pass through.
    expect(spice.raw.kind).toBe("wasm");

    // Raw methods are awaitable.
    await spice.raw.kclear();
    expect(await spice.raw.ktotal("ALL")).toBe(0);

    // Kit methods are awaitable.
    const version = await spice.kit.toolkitVersion();
    expect(version).toBeTypeOf("string");
    expect(version).not.toBe("");

    // Optional: parity check (method names match between sync-ish and async clients).
    const sync = await createSpice({ backend: "wasm" });
    expect(Object.keys(sync.kit).sort()).toEqual(Object.keys(spice.kit).sort());
  });
});
