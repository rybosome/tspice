import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

describe("tpictr", () => {
  it("depends on the sample format (not output template length)", async () => {
    const wasm = await createWasmBackend();

    // Samples from NAIF `tpictr_c` docs.
    const sampleA = "Thu Oct 01 11:11:11 PDT 1111";
    const expectedA = "Wkd Mon DD HR:MN:SC PDT YYYY ::UTC-7";

    const sampleB = "24 Mar 2018  16:23:00 UTC";
    const expectedB = "DD Mon YYYY  HR:MN:SC UTC ::UTC";

    // The `pictur` argument is an output template in CSPICE bindings; its length
    // should not limit output in our shim (we always allow expansion up to the
    // full output buffer size).
    const shortTemplate = "X";
    const longTemplate = " ".repeat(4_096);

    expect(wasm.tpictr(sampleA, shortTemplate)).toBe(expectedA);
    expect(wasm.tpictr(sampleA, longTemplate)).toBe(expectedA);

    expect(wasm.tpictr(sampleB, shortTemplate)).toBe(expectedB);
    expect(wasm.tpictr(sampleB, longTemplate)).toBe(expectedB);

    expect(expectedA).not.toBe(expectedB);
  });

  it("preserves long runs of whitespace in the derived picture", async () => {
    const wasm = await createWasmBackend();

    // `tpictr` generates a picture that matches the sample's formatting,
    // including literal whitespace.
    const pad = " ".repeat(290);
    const sample = `24 Mar 2018${pad}16:23:00 UTC`;

    // In other CSPICE bindings `pictur` is modeled as an "output template";
    // use a long-ish one here to match that expectation.
    const template = " ".repeat(4_096);

    const out = wasm.tpictr(sample, template);

    const expected = `DD Mon YYYY${pad}HR:MN:SC UTC ::UTC`;
    expect(out).toBe(expected);
    expect(out.length).toBeGreaterThan(300);
  });
});
