import { expect, it } from "vitest";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

it.runIf(nodeAddonAvailable())(
  "validates the actual native character handle and both strings before parsing",
  () => {
    const native = getNativeAddon();
    const cell = native.newCharCell(2, 8),
      integer = native.newIntCell(2);
    try {
      for (const malformed of [1, {}, null, "A\0B", "\uDFFF"]) {
        expect(() => native.lparss(malformed as never, ",", cell)).toThrow();
        expect(() => native.lparss("A", malformed as never, cell)).toThrow();
      }
      expect(() => native.lparss("A", ",", integer)).toThrow();
      native.lparss("B,A", ",", cell);
      expect(native.card(cell)).toBe(2);
      expect(native.cellGetc(cell, 0)).toBe("A");
    } finally {
      native.freeCell(cell);
      native.freeCell(integer);
    }
    expect(() => native.lparss("A", ",", cell)).toThrow();
  },
);
