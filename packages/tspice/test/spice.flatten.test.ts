import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SpiceError, createSpice } from "@rybosome/tspice";
import type { SpiceBackend } from "@rybosome/tspice";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lskPath = path.join(__dirname, "fixtures", "kernels", "naif0012.tls");

describe("createSpice() flatten-by-default", () => {
  it("forwards backend primitives at the top-level", async () => {
    const spice = await createSpice({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);

    // These are backend methods (not on the facade).
    spice.kclear();
    expect(spice.ktotal("ALL")).toBe(0);

    spice.furnsh({ path: "/kernels/naif0012.tls", bytes: lskBytes });
    expect(spice.ktotal("ALL")).toBeGreaterThan(0);

    spice.unload("/kernels/naif0012.tls");
    spice.kclear();
    expect(spice.ktotal("ALL")).toBe(0);
  });

  it("wraps forwarded backend errors as SpiceError", async () => {
    const spice = await createSpice({ backend: "wasm" });

    try {
      spice.furnsh("/does/not/exist.tls");
      throw new Error("expected furnsh to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SpiceError);
      expect((err as SpiceError).operation).toBe("furnsh");
    }
  });

  it("wraps Promise rejections from forwarded backend methods", async () => {
    // SpiceBackend methods are sync today, but `createSpice()` should still
    // wrap async failures consistently.
    const backendInstance = {
      kind: "fake",
      spiceVersion: () => "fake",
      furnsh: () => undefined,
      unload: () => undefined,
      kclear: () => undefined,
      ktotal: () => 0,
      kdata: () => ({ found: false }),
      tkvrsn: () => Promise.reject(new Error("boom")),
    } as any as SpiceBackend;

    const spice = await createSpice({ backendInstance });

    await expect((spice as any).tkvrsn("TOOLKIT")).rejects.toMatchObject({
      name: "SpiceError",
      operation: "tkvrsn",
    });
  });
});
