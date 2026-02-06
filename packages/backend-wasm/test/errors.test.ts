import { beforeAll, describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

let backend: Awaited<ReturnType<typeof createWasmBackend>>;

beforeAll(async () => {
  backend = await createWasmBackend();
}, 20_000);

describe("SPICE errors (wasm backend)", () => {
  it("throws a rich error containing a stable short code", () => {
    let err: unknown;
    try {
      // With no kernels loaded, this should reliably fail with NOLOADEDFILES.
      backend.spkezr("EARTH", 0, "J2000", "NONE", "SUN");
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(Error);
    const e = err as Error & {
      spiceShort?: string;
      spiceLong?: string;
      spiceTrace?: string;
    };

    expect(e.message).toContain("NOLOADEDFILES");
    expect(e.spiceShort).toContain("NOLOADEDFILES");
    expect(typeof e.spiceLong).toBe("string");
    expect(typeof e.spiceTrace).toBe("string");
  });

  it("preserves Found-style {found:false} behavior", () => {
    expect(backend.bodn2c("NOT_A_BODY")).toEqual({ found: false });
  });
});
