import { describe, expect, it } from "vitest";

import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

describe("@rybosome/tspice-backend-node kernel pool", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative("rejects empty/blank kernel-pool string identifiers", () => {
    const b = createNodeBackend();

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

  itNative("pcpool validates its (string, string[]) signature", () => {
    const b = createNodeBackend();

    // Regression test: signature guard should reject non-array `values`.
    // (This yields a clearer, consistent boundary error than letting it fall
    // through to ReadStringArray.)
    expect(() => (b as any).pcpool("A", "NOT_ARRAY")).toThrow(TypeError);
    expect(() => (b as any).pcpool("A", "NOT_ARRAY")).toThrow(/expects \(string, string\[\]\)/i);
  });

  itNative("swpool validates its (string, string[]) signature", () => {
    const b = createNodeBackend();

    // Regression test: signature guard should reject non-array `names`.
    expect(() => (b as any).swpool("AGENT", "NOT_ARRAY")).toThrow(TypeError);
    expect(() => (b as any).swpool("AGENT", "NOT_ARRAY")).toThrow(/expects \(string, string\[\]\)/i);
  });

  itNative("swpool rejects empty/blank names entries", () => {
    const b = createNodeBackend();

    for (const blank of ["", "   " as const]) {
      expect(() => b.raw.swpool("AGENT", [blank])).toThrow(RangeError);
    }
  });
});
