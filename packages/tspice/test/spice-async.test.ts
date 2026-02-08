import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createSpiceAsync } from "@rybosome/tspice";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lskPath = path.join(__dirname, "fixtures", "kernels", "naif0012.tls");

describe("createSpiceAsync()", () => {
  it("returns { raw, kit } and makes methods awaitable", async () => {
    const spice = await createSpiceAsync({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);

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

    await spice.kit.loadKernel({ path: "naif0012.tls", bytes: lskBytes });
    expect(await spice.raw.ktotal("ALL")).toBeGreaterThan(0);
    await spice.kit.unloadKernel("naif0012.tls");
    expect(await spice.raw.ktotal("ALL")).toBe(0);
  });
});
