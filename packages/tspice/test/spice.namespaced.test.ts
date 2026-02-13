import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SpiceError, spiceClients } from "@rybosome/tspice";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lskPath = path.join(__dirname, "fixtures", "kernels", "naif0012.tls");

describe("spice client shape", () => {
  it("returns exactly { raw, kit } (no flattening)", async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });
    try {
      const lskBytes = fs.readFileSync(lskPath);

      expect(spice).toHaveProperty("raw");
      expect(spice).toHaveProperty("kit");
      expect((spice as any).furnsh).toBeUndefined();
      expect((spice as any).loadKernel).toBeUndefined();

      // Backend primitives live under `raw`.
      spice.raw.kclear();
      expect(spice.raw.ktotal("ALL")).toBe(0);

      spice.raw.furnsh({ path: "naif0012.tls", bytes: lskBytes });
      expect(spice.raw.ktotal("ALL")).toBeGreaterThan(0);

      spice.raw.unload("naif0012.tls");
      spice.raw.kclear();
      expect(spice.raw.ktotal("ALL")).toBe(0);
    } finally {
      await dispose();
    }
  });

  it("kit wraps backend failures as SpiceError", async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });
    try {
      try {
        spice.kit.loadKernel("/does/not/exist.tls");
        throw new Error("expected loadKernel to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(SpiceError);
        expect((err as SpiceError).operation).toBe("loadKernel");
      }
    } finally {
      await dispose();
    }
  });
});
