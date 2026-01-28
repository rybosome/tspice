import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SpiceError, createSpice } from "@rybosome/tspice";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lskPath = path.join(__dirname, "fixtures", "kernels", "naif0012.tls");

describe("createSpice() namespaced return", () => {
  it("returns { primitive, tools } (no flattening)", async () => {
    const spice = await createSpice({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);

    expect(spice).toHaveProperty("primitive");
    expect(spice).toHaveProperty("tools");
    expect((spice as any).furnsh).toBeUndefined();
    expect((spice as any).loadKernel).toBeUndefined();

    // Backend primitives live under `primitive`.
    spice.primitive.kclear();
    expect(spice.primitive.ktotal("ALL")).toBe(0);

    spice.primitive.furnsh({ path: "/kernels/naif0012.tls", bytes: lskBytes });
    expect(spice.primitive.ktotal("ALL")).toBeGreaterThan(0);

    spice.primitive.unload("/kernels/naif0012.tls");
    spice.primitive.kclear();
    expect(spice.primitive.ktotal("ALL")).toBe(0);
  });

  it("tools wrap backend failures as SpiceError", async () => {
    const spice = await createSpice({ backend: "wasm" });

    try {
      spice.tools.loadKernel("/does/not/exist.tls");
      throw new Error("expected loadKernel to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SpiceError);
      expect((err as SpiceError).operation).toBe("loadKernel");
    }
  });
});
