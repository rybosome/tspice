import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import type { NativeAddon } from "../src/runtime/addon.js";

const vectorMethods = [
  "vdist",
  "vequ",
  "vupack",
  "vzero",
  "unorm",
  "ucrss",
  "vsep",
] as const;
const methods = [...vectorMethods, "vpack"] as const;
type Method = (typeof methods)[number];

function apiFor(native: Partial<NativeAddon>) {
  // Only the selected mock is invoked. This contained partial-addon assertion
  // permits deliberate malformed outputs without inventing unused methods.
  return createCoordsVectorsApi(native as NativeAddon);
}

function outputFor(name: Method): unknown {
  if (name === "vzero") return true;
  if (name === "vdist" || name === "vsep") return 0.375;
  if (name === "vupack") return { x: 11, y: -23, z: 37 };
  if (name === "unorm") return { unit: [0.1, -0.2, 0.3], norm: 123 };
  return [11, -23, 37];
}

function argumentsFor(name: Method): unknown[] {
  if (name === "vpack") return [11, -23, 37];
  if (name === "vdist" || name === "ucrss" || name === "vsep")
    return [
      [1, -2, 3],
      [4, 5, -6],
    ];
  return [[1, -2, 3]];
}

function invalidOutputs(name: Method): unknown[] {
  if (name === "vzero") return [0, 1, "false", null, undefined];
  if (name === "vdist" || name === "vsep")
    return ["1", null, undefined, [], {}];
  if (name === "vupack")
    return [null, [], {}, { x: 1, y: 2 }, { x: 1, y: "2", z: 3 }];
  if (name === "unorm")
    return [
      null,
      [],
      {},
      { unit: [1, 2, 3] },
      { unit: [1, 2], norm: 4 },
      { unit: [1, "2", 3], norm: 4 },
      { unit: [1, 2, 3], norm: "4" },
    ];
  return [
    null,
    {},
    [1, 2],
    [1, 2, 3, 4],
    [1, "2", 3],
    Object.assign(new Array<number>(3), { 0: 1, 2: 3 }),
  ];
}

describe("native basic-vector boundary", () => {
  for (const name of vectorMethods) {
    it(`${name} rejects malformed vectors before native execution, then accepts readonly input`, () => {
      const call = vi.fn().mockReturnValue(outputFor(name));
      const api = apiFor({ [name]: call });
      const good = argumentsFor(name);
      for (let position = 0; position < good.length; position++) {
        for (const invalid of [
          null,
          {},
          [1, 2],
          [1, 2, 3, 4],
          Object.assign(new Array<number>(3), { 0: 1, 2: 3 }),
          [1, "2", 3],
          [1, NaN, 3],
          [1, Infinity, 3],
          new Float64Array([1, 2, 3]),
        ]) {
          const args = [...good];
          args[position] = invalid;
          expect(() => Reflect.apply(api[name], undefined, args)).toThrow(
            TypeError,
          );
        }
      }
      expect(call).not.toHaveBeenCalled();
      const vector = Object.freeze([1, -2, 3] as const);
      const args = good.map(() => vector);
      Reflect.apply(api[name], undefined, args);
      expect(call).toHaveBeenCalledTimes(1);
      expect(call).toHaveBeenCalledWith(...args);
      expect(vector).toEqual([1, -2, 3]);
    });
  }

  it("vpack rejects malformed scalars and preserves ordering and signed zero", () => {
    const call = vi.fn().mockReturnValue([-0, -2, 3]);
    const api = apiFor({ vpack: call });
    for (let position = 0; position < 3; position++) {
      for (const invalid of [NaN, Infinity, -Infinity, "1", null, undefined]) {
        const args: unknown[] = [1, 2, 3];
        args[position] = invalid;
        expect(() => Reflect.apply(api.vpack, undefined, args)).toThrow(
          TypeError,
        );
      }
    }
    expect(call).not.toHaveBeenCalled();
    expect(api.vpack(-0, -2, 3)).toEqual([-0, -2, 3]);
    expect(call).toHaveBeenCalledWith(-0, -2, 3);
  });

  for (const name of methods) {
    it(`${name} rejects malformed native output and permits recovery`, () => {
      const call = vi.fn();
      const api = apiFor({ [name]: call });
      for (const malformed of invalidOutputs(name)) {
        call.mockReturnValueOnce(malformed);
        expect(() =>
          Reflect.apply(api[name], undefined, argumentsFor(name)),
        ).toThrow(TypeError);
      }
      const expected = outputFor(name);
      call.mockReturnValueOnce(expected);
      expect(Reflect.apply(api[name], undefined, argumentsFor(name))).toEqual(
        expected,
      );
    });

    it(`${name} preserves native failures`, () => {
      const failure = new Error("native vector failure");
      const api = apiFor({
        [name]: () => {
          throw failure;
        },
      });
      expect(() =>
        Reflect.apply(api[name], undefined, argumentsFor(name)),
      ).toThrow(failure);
    });
  }

  for (const name of ["vequ", "vpack", "ucrss"] as const) {
    it(`${name} copies native output instead of exposing native-owned storage`, () => {
      const nativeArray = [11, -23, 37];
      const api = apiFor({ [name]: () => nativeArray });
      const result = Reflect.apply(api[name], undefined, argumentsFor(name));
      nativeArray[0] = 999;
      expect(result).toEqual([11, -23, 37]);
    });
  }

  it("unorm copies nested vector storage and keeps the original norm", () => {
    const nativeResult = { unit: [0.1, -0.2, 0.3], norm: 123 };
    const api = apiFor({ unorm: () => nativeResult });
    const result = api.unorm([1, -2, 3]);
    nativeResult.unit[0] = 999;
    nativeResult.norm = 999;
    expect(result).toEqual({ unit: [0.1, -0.2, 0.3], norm: 123 });
  });

  it("preserves possible CSPICE overflow results from finite inputs", () => {
    const api = apiFor({
      vdist: () => NaN,
      unorm: () => ({ unit: [0, 0, 0], norm: Infinity }),
    });
    expect(
      api.vdist([Number.MAX_VALUE, 0, 0], [-Number.MAX_VALUE, 0, 0]),
    ).toBeNaN();
    expect(api.unorm([Number.MAX_VALUE, Number.MAX_VALUE, 0])).toEqual({
      unit: [0, 0, 0],
      norm: Infinity,
    });
  });
});
