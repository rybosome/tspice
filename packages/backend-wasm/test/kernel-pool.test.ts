import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

describe("@rybosome/tspice-backend-wasm kernel pool", () => {
  it("rejects empty/blank kernel-pool string identifiers", async () => {
    const b = await createWasmBackend();

    for (const name of ["", "   "]) {
      expect(() => b.raw.gdpool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.raw.gipool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.raw.gcpool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.raw.dtpool(name)).toThrow(RangeError);

      expect(() => b.raw.pdpool(name, [1])).toThrow(RangeError);
      expect(() => b.raw.pipool(name, [1])).toThrow(RangeError);
      expect(() => b.raw.pcpool(name, ["A"])).toThrow(RangeError);

      expect(() => b.raw.expool(name)).toThrow(RangeError);
    }

    for (const template of ["", "   "]) {
      expect(() => b.raw.gnpool(template, 0, 1)).toThrow(RangeError);
    }

    for (const agent of ["", "   "]) {
      expect(() => b.raw.swpool(agent, [])).toThrow(RangeError);
      expect(() => b.raw.cvpool(agent)).toThrow(RangeError);
    }
  });


  it("swpool rejects empty/blank names entries", async () => {
    const b = await createWasmBackend();

    for (const blank of ["", "   "]) {
      expect(() => b.raw.swpool("AGENT", [blank])).toThrow(RangeError);
    }
  });
});
