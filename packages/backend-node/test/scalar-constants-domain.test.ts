import { describe, expect, it, vi } from "vitest";

import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { createTimeApi } from "../src/domains/time.js";
import type { NativeAddon } from "../src/runtime/addon.js";

const doubles = [
  "clight",
  "dpmax",
  "dpmin",
  "b1900",
  "j1950",
  "j2100",
  "jyear",
  "tyear",
] as const;
const integers = ["intmax", "intmin"] as const;

function makeApi(native: Partial<NativeAddon>) {
  // These tests invoke only the explicitly mocked entrypoint. The partial
  // addon intentionally permits malformed native results at the boundary.
  return {
    ...createCoordsVectorsApi(native as NativeAddon),
    ...createTimeApi(native as NativeAddon),
  };
}

describe("scalar constant native output boundary", () => {
  for (const name of doubles) {
    it(`${name} rejects malformed output and preserves finite extremes`, () => {
      const call = vi.fn();
      const api = makeApi({ [name]: call });
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
      for (const value of [
        Number.MAX_VALUE,
        -Number.MAX_VALUE,
        1.2345678901234567,
      ]) {
        call.mockReturnValueOnce(value);
        expect(api[name]()).toBe(value);
      }
      expect(call).toHaveBeenCalledTimes(9);
      expect(call).toHaveBeenLastCalledWith();
    });
  }

  for (const name of integers) {
    it(`${name} rejects non-SpiceInt results without truncating or wrapping`, () => {
      const call = vi.fn();
      const api = makeApi({ [name]: call });
      for (const malformed of [
        NaN,
        Infinity,
        -Infinity,
        "3",
        null,
        undefined,
        1.5,
        2147483648,
        -2147483649,
      ]) {
        call.mockReturnValueOnce(malformed);
        expect(() => api[name]()).toThrow();
      }
      for (const value of [2147483647, -2147483648]) {
        call.mockReturnValueOnce(value);
        expect(api[name]()).toBe(value);
      }
      expect(call).toHaveBeenCalledTimes(11);
      expect(call).toHaveBeenLastCalledWith();
    });
  }

  for (const name of [...doubles, ...integers]) {
    it(`${name} preserves a thrown addon failure`, () => {
      const failure = new Error("native entrypoint failed");
      const api = makeApi({
        [name]: () => {
          throw failure;
        },
      });
      expect(() => api[name]()).toThrow(failure);
    });
  }
});
