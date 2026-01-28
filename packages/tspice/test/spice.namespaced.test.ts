import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SpiceError, createSpice } from "@rybosome/tspice";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lskPath = path.join(__dirname, "fixtures", "kernels", "naif0012.tls");

describe("createSpice() namespaced return", () => {
  it("returns { cspice, kit } (no flattening)", async () => {
    const spice = await createSpice({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);

    expect(spice).toHaveProperty("cspice");
    expect(spice).toHaveProperty("kit");
    expect((spice as any).furnsh).toBeUndefined();
    expect((spice as any).loadKernel).toBeUndefined();

    // Backend primitives live under `cspice`.
    spice.cspice.kclear();
    expect(spice.cspice.ktotal("ALL")).toBe(0);

    spice.cspice.furnsh({ path: "/kernels/naif0012.tls", bytes: lskBytes });
    expect(spice.cspice.ktotal("ALL")).toBeGreaterThan(0);

    spice.cspice.unload("/kernels/naif0012.tls");
    spice.cspice.kclear();
    expect(spice.cspice.ktotal("ALL")).toBe(0);
  });

  it("kit wraps backend failures as SpiceError", async () => {
    const spice = await createSpice({ backend: "wasm" });

    try {
      spice.kit.loadKernel("/does/not/exist.tls");
      throw new Error("expected loadKernel to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SpiceError);
      expect((err as SpiceError).operation).toBe("loadKernel");
    }
  });
});
