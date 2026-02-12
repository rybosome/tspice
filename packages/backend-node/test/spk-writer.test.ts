import { describe, expect, it } from "vitest";

import { createNodeBackend } from "@rybosome/tspice-backend-node";

import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

describe("SPK writers (type 8)", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative("writes a minimal type 8 segment and reads it back", () => {
    const backend = createNodeBackend();

    const output = { kind: "virtual-output", path: "spk-writer-test.bsp" } as const;

    const handle = backend.spkopn(output, "TSPICE", 0);

    // Two state records: linear motion along +X at 1 km/s.
    const states = [
      // t=0
      0, 0, 0, 1, 0, 0,
      // t=60
      60, 0, 0, 1, 0, 0,
    ];

    backend.spkw08(
      handle,
      1000, // body
      0, // center
      "J2000",
      0, // first
      60, // last
      "TSPICE_TYPE8_TEST",
      1, // degree
      states,
      0, // epoch1
      60, // step
    );

    // Lifecycle: virtual outputs should not be readable until the writer handle
    // is closed.
    expect(() => backend.readVirtualOutput(output)).toThrow(/open|close/i);

    backend.spkcls(handle);

    const bytes = backend.readVirtualOutput(output);
    expect(bytes.byteLength).toBeGreaterThan(0);

    // Contract: return a plain Uint8Array (not a Node Buffer).
    expect(Buffer.isBuffer(bytes)).toBe(false);

    // Validate the SPK by loading it from bytes.
    backend.furnsh({ path: output.path, bytes });

    const { state } = backend.spkezr("1000", 30, "J2000", "NONE", "0");
    expect(state[0]).toBeCloseTo(30, 10);
    expect(state[1]).toBeCloseTo(0, 10);
    expect(state[2]).toBeCloseTo(0, 10);
    expect(state[3]).toBeCloseTo(1, 10);
    expect(state[4]).toBeCloseTo(0, 10);
    expect(state[5]).toBeCloseTo(0, 10);

    backend.kclear();
  });

  itNative("rejects path traversal in VirtualOutput.path", () => {
    const backend = createNodeBackend();

    expect(() =>
      backend.spkopn({ kind: "virtual-output", path: "../evil.bsp" }, "TSPICE", 0),
    ).toThrow(/\.\.|invalid/i);
  });

  itNative("provides a clearer error for missing virtual output files", () => {
    const backend = createNodeBackend();

    expect(() =>
      backend.readVirtualOutput({ kind: "virtual-output", path: "missing-output.bsp" }),
    ).toThrow(/no staged file found|virtual output/i);
  });
});
