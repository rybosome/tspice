import { describe, expect, it } from "vitest";

import { assertEmscriptenModule } from "../src/lowlevel/exports.js";

describe("assertEmscriptenModule", () => {
  it("throws when required exports are missing", () => {
    expect(() => assertEmscriptenModule({})).toThrow(/missing\/invalid exports/i);
  });

  it("accepts a minimally-shaped module", () => {
    const base: Record<string, unknown> = {
      HEAPU8: new Uint8Array(1),
      HEAP32: new Int32Array(1),
      HEAPF64: new Float64Array(1),
      FS: {
        mkdirTree: () => {},
        writeFile: () => {},
      },
    };

    const m = new Proxy(base, {
      get(target, prop) {
        if (typeof prop === "string" && prop in target) {
          return target[prop];
        }
        // Default every other lookup to a function so we don't have to stub
        // dozens of exports in this unit test.
        return () => {};
      },
    });

    expect(() => assertEmscriptenModule(m)).not.toThrow();
  });
});
