import { describe, expect, it, vi } from "vitest";

import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { createTimeApi } from "../src/domains/time.js";
import type { NativeAddon } from "../src/runtime/addon.js";

const constants = [
  "pi",
  "twopi",
  "halfpi",
  "dpr",
  "rpd",
  "spd",
  "j2000",
  "j1900",
  "b1950",
] as const;

describe("constant native output boundary", () => {
  for (const name of constants) {
    it(`${name} rejects malformed addon output and permits recovery`, () => {
      const call = vi.fn();
      // Only this entrypoint is invoked. Malformed return values intentionally
      // exercise the runtime boundary independently of the addon's static type.
      const native: Partial<NativeAddon> = { [name]: call };
      const api = {
        ...createCoordsVectorsApi(native as NativeAddon),
        ...createTimeApi(native as NativeAddon),
      };
      for (const malformed of [
        NaN,
        Infinity,
        -Infinity,
        "3",
        null,
        undefined,
      ]) {
        call.mockReturnValueOnce(malformed);
        expect(() => api[name]()).toThrow(
          `Expected ${name}() to return a finite number`,
        );
      }
      call.mockReturnValueOnce(1.2345678901234567);
      expect(api[name]()).toBe(1.2345678901234567);
      expect(call).toHaveBeenCalledTimes(7);
      expect(call).toHaveBeenLastCalledWith();
    });

    it(`${name} preserves an addon failure without substituting a value`, () => {
      const failure = new Error("native entrypoint failed");
      const native: Partial<NativeAddon> = {
        [name]: () => {
          throw failure;
        },
      };
      const api = {
        ...createCoordsVectorsApi(native as NativeAddon),
        ...createTimeApi(native as NativeAddon),
      };
      expect(() => api[name]()).toThrow(failure);
    });
  }
});
