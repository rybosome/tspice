import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

describe("SPK writers (type 8)", () => {
  it("writes a minimal type 8 segment and reads it back", async () => {
    const backend = await createWasmBackend();

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

    // Load by virtual path and validate interpolation at t=30.
    backend.furnsh(output.path);

    const { state } = backend.spkezr("1000", 30, "J2000", "NONE", "0");
    expect(state[0]).toBeCloseTo(30, 10);
    expect(state[1]).toBeCloseTo(0, 10);
    expect(state[2]).toBeCloseTo(0, 10);
    expect(state[3]).toBeCloseTo(1, 10);
    expect(state[4]).toBeCloseTo(0, 10);
    expect(state[5]).toBeCloseTo(0, 10);

    const bytes = backend.readVirtualOutput(output);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("does not allow readVirtualOutput() as a generic FS read", async () => {
    const backend = await createWasmBackend();

    expect(() =>
      backend.readVirtualOutput({ kind: "virtual-output", path: "naif0012.tls" }),
    ).toThrow(/known virtual output|writer/i);
  });
});
