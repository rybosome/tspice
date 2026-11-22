import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import type { NativeAddon } from "../src/runtime/addon.js";

const scalarMethods = [
  "cyllat",
  "cylrec",
  "cylsph",
  "latcyl",
  "latsph",
  "sphcyl",
  "sphlat",
] as const;
const methods = [...scalarMethods, "reccyl"] as const;

function apiFor(native: Partial<NativeAddon>) {
  // Each case invokes only its explicit mock; unrelated native entrypoints
  // are intentionally absent so unexpected delegation fails immediately.
  return createCoordsVectorsApi(native as NativeAddon);
}

function nativeOutput(name: (typeof methods)[number]) {
  if (name === "cylrec") return [11, -23, 37];
  return { radius: 11, lon: -23, lat: 37, colat: 37, z: 37 };
}

function argsFor(name: (typeof methods)[number]): unknown[] {
  return name === "reccyl" ? [[-2, 7, -3]] : [-2, 7, -3];
}

describe("native cylindrical coordinate boundary", () => {
  for (const name of scalarMethods) {
    it(`${name} rejects every nonfinite/nonnumeric input before native execution`, () => {
      const call = vi.fn().mockReturnValue(nativeOutput(name));
      const api = apiFor({ [name]: call });
      for (let position = 0; position < 3; position++) {
        for (const invalid of [
          NaN,
          Infinity,
          -Infinity,
          "1",
          null,
          undefined,
        ]) {
          const args: unknown[] = [1, 2, 3];
          args[position] = invalid;
          expect(() => Reflect.apply(api[name], undefined, args)).toThrow(
            TypeError,
          );
        }
      }
      expect(call).not.toHaveBeenCalled();
      // Radius signs and unrestricted angle values must not be normalized.
      Reflect.apply(api[name], undefined, [-2, 7, -3]);
      expect(call).toHaveBeenCalledTimes(1);
      expect(call).toHaveBeenCalledWith(-2, 7, -3);
    });
  }

  it("reccyl rejects invalid vectors before native execution and preserves input", () => {
    const call = vi.fn().mockReturnValue({ radius: 3, lon: 1, z: -4 });
    const api = apiFor({ reccyl: call });
    for (const invalid of [
      null,
      {},
      [1, 2],
      [1, 2, 3, 4],
      Object.assign(new Array<number>(3), { 0: 1, 2: 3 }),
      [1, "2", 3],
      [1, NaN, 3],
      [Infinity, 2, 3],
      new Float64Array([1, 2, 3]),
    ]) {
      expect(() => Reflect.apply(api.reccyl, undefined, [invalid])).toThrow(
        TypeError,
      );
    }
    expect(call).not.toHaveBeenCalled();
    const input: [number, number, number] = [-2, 7, -3];
    api.reccyl(input);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith(input);
    expect(input).toEqual([-2, 7, -3]);
  });

  for (const name of methods) {
    it(`${name} validates native output and copies its result`, () => {
      const call = vi.fn();
      const api = apiFor({ [name]: call });
      const malformed =
        name === "cylrec"
          ? [null, {}, [1, 2], [1, 2, 3, 4], [1, "2", 3]]
          : [
              null,
              [],
              {},
              { radius: 1, lon: 2 },
              { radius: "1", lon: 2, lat: 3, colat: 3, z: 3 },
            ];
      for (const value of malformed) {
        call.mockReturnValueOnce(value);
        expect(() =>
          Reflect.apply(api[name], undefined, argsFor(name)),
        ).toThrow(TypeError);
      }
      const output = nativeOutput(name);
      call.mockReturnValueOnce(output);
      const result = Reflect.apply(api[name], undefined, argsFor(name));
      expect(result).not.toBe(output);
      if (Array.isArray(output)) {
        expect(result).toEqual([11, -23, 37]);
        output[0] = 999;
        expect(result).toEqual([11, -23, 37]);
      } else {
        expect(result.radius).toBe(11);
        output.radius = 999;
        expect(result.radius).toBe(11);
      }
    });

    it(`${name} preserves a thrown native failure`, () => {
      const failure = new Error("native conversion failed");
      const api = apiFor({
        [name]: () => {
          throw failure;
        },
      });
      expect(() => Reflect.apply(api[name], undefined, argsFor(name))).toThrow(
        failure,
      );
    });
  }

  it("preserves the overflow result produced by a finite-input CSPICE norm", () => {
    const api = apiFor({
      cyllat: () => ({ radius: Infinity, lon: 2, lat: 0.5 }),
    });
    expect(api.cyllat(Number.MAX_VALUE, 2, Number.MAX_VALUE)).toEqual({
      radius: Infinity,
      lon: 2,
      lat: 0.5,
    });
  });
});
