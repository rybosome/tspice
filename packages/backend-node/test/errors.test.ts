import { describe, expect, it } from "vitest";

import { createNodeBackend } from "@rybosome/tspice-backend-node";

import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

describe("SPICE errors (node backend)", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative("throws a rich error containing a stable short code", () => {
    const backend = createNodeBackend();

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

  itNative("preserves Found-style {found:false} behavior", () => {
    const backend = createNodeBackend();

    // bodn2c is a Found-style routine: unknown names are not exceptional.
    expect(backend.bodn2c("NOT_A_BODY")).toEqual({ found: false });
  });

  itNative("rejects invalid getmsg(which) selectors at the boundary", () => {
    const backend = createNodeBackend();
    expect(() => backend.getmsg("NOPE" as never)).toThrow(/getmsg\(which\)/i);
    expect(() => backend.getmsg("NOPE" as never)).toThrow(/SHORT|LONG|EXPLAIN/);
  });
});
