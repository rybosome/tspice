import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

describe("@rybosome/tspice-backend-wasm kernel pool", () => {
  it("rejects empty/blank kernel-pool string identifiers", async () => {
    const b = await createWasmBackend();

    for (const name of ["", "   "]) {
      expect(() => b.gdpool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.gipool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.gcpool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.dtpool(name)).toThrow(RangeError);

      expect(() => b.pdpool(name, [1])).toThrow(RangeError);
      expect(() => b.pipool(name, [1])).toThrow(RangeError);
      expect(() => b.pcpool(name, ["A"])).toThrow(RangeError);

      expect(() => b.expool(name)).toThrow(RangeError);
    }

    for (const template of ["", "   "]) {
      expect(() => b.gnpool(template, 0, 1)).toThrow(RangeError);
    }

    for (const agent of ["", "   "]) {
      expect(() => b.swpool(agent, [])).toThrow(RangeError);
      expect(() => b.cvpool(agent)).toThrow(RangeError);
    }
  });


  it("swpool rejects empty/blank names entries", async () => {
    const b = await createWasmBackend();

    for (const blank of ["", "   "]) {
      expect(() => b.swpool("AGENT", [blank])).toThrow(RangeError);
    }
  });
});
