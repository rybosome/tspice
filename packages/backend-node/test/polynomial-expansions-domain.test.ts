import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

type Method = "chbder" | "chbigr" | "chbint" | "chbval" | "polyds" | "rquad";
const cp = Object.freeze([1, -2, 3]);
const x2s = Object.freeze([7, -5] as const);
const cases: readonly {
  name: Method;
  args: readonly unknown[];
  scalarPositions: readonly number[];
  coefficientPosition?: number;
  transformPosition?: number;
  output: unknown;
}[] = [
  {
    name: "chbder",
    args: [cp, x2s, 3, 2],
    scalarPositions: [2],
    coefficientPosition: 0,
    transformPosition: 1,
    output: [11, -13, 17],
  },
  {
    name: "chbigr",
    args: [cp, x2s, 3],
    scalarPositions: [2],
    coefficientPosition: 0,
    transformPosition: 1,
    output: { p: 11, itgrlp: -13 },
  },
  {
    name: "chbint",
    args: [cp, x2s, 3],
    scalarPositions: [2],
    coefficientPosition: 0,
    transformPosition: 1,
    output: { p: 11, dpdx: -13 },
  },
  {
    name: "chbval",
    args: [cp, x2s, 3],
    scalarPositions: [2],
    coefficientPosition: 0,
    transformPosition: 1,
    output: 11,
  },
  {
    name: "polyds",
    args: [cp, 2, 3],
    scalarPositions: [2],
    coefficientPosition: 0,
    output: [11, -13, 17],
  },
  {
    name: "rquad",
    args: [2, -3, 5],
    scalarPositions: [0, 1, 2],
    output: { root1: [11, -13], root2: [17, -19] },
  },
];

function apiFor(native: Partial<NativeAddon>) {
  // Tests call only their configured method, including deliberately malformed
  // native results; this assertion does not weaken production validation.
  return createCoordsVectorsApi(native as NativeAddon);
}

const invalidNumbers: readonly unknown[] = [
  NaN,
  Infinity,
  -Infinity,
  "1",
  null,
  undefined,
  1n,
];

function malformedResults(name: Method): unknown[] {
  const common: unknown[] = [
    null,
    undefined,
    "1",
    1n,
    {},
    new DataView(new ArrayBuffer(24)),
  ];
  if (name === "chbder" || name === "polyds") {
    common.push(
      [],
      [1, 2],
      [1, 2, 3, 4],
      new Float64Array(3),
      new BigInt64Array(3),
      Object.assign(new Array<number>(3), { 0: 1, 2: 3 }),
    );
    for (let i = 0; i < 3; i++) {
      const result: unknown[] = [1, 2, 3];
      result[i] = "1";
      common.push(result);
    }
  } else if (name === "chbigr" || name === "chbint") {
    const key = name === "chbigr" ? "itgrlp" : "dpdx";
    common.push(
      { p: 1 },
      { [key]: 1 },
      { p: "1", [key]: 1 },
      { p: 1, [key]: 1n },
    );
  } else if (name === "rquad") {
    const invalidPairs: unknown[] = [
      [],
      [1],
      [1, 2, 3],
      [1, "2"],
      [1n, 2],
      new Float64Array(2),
      new BigInt64Array(2),
      new Array<number>(2),
    ];
    for (const pair of invalidPairs)
      common.push(
        { root1: pair, root2: [3, 4] },
        { root1: [1, 2], root2: pair },
      );
  } else common.push([]);
  return common;
}

describe("native polynomial adapter boundary", () => {
  for (const spec of cases) {
    it(`${spec.name} preserves argument order and readonly inputs`, () => {
      const call = vi.fn().mockReturnValue(spec.output);
      const api = apiFor({ [spec.name]: call });
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        spec.output,
      );
      expect(call).toHaveBeenCalledOnce();
      expect(call).toHaveBeenCalledWith(...spec.args);
      expect(cp).toEqual([1, -2, 3]);
      expect(x2s).toEqual([7, -5]);
    });

    it(`${spec.name} validates every scalar and array entry before calling native code`, () => {
      const call = vi.fn().mockReturnValue(spec.output);
      const api = apiFor({ [spec.name]: call });
      for (const position of spec.scalarPositions)
        for (const value of invalidNumbers) {
          const args = [...spec.args];
          args[position] = value;
          expect(() =>
            Reflect.apply(api[spec.name], undefined, args),
          ).toThrow();
        }
      for (const position of [
        spec.coefficientPosition,
        spec.transformPosition,
      ]) {
        if (position === undefined) continue;
        const length = position === spec.transformPosition ? 2 : 3;
        const invalid: unknown[] = [
          null,
          {},
          "1",
          new Float64Array(length),
          new BigInt64Array(length),
          new DataView(new ArrayBuffer(24)),
          new Array<number>(length),
        ];
        if (position === spec.transformPosition)
          invalid.push([], [1], [1, 2, 3]);
        for (let i = 0; i < length; i++)
          for (const value of invalidNumbers) {
            const array: unknown[] = Array.from({ length }, () => 1);
            array[i] = value;
            invalid.push(array);
          }
        for (const value of invalid) {
          const args = [...spec.args];
          args[position] = value;
          expect(() =>
            Reflect.apply(api[spec.name], undefined, args),
          ).toThrow();
        }
      }
      expect(call).not.toHaveBeenCalled();
    });

    it(`${spec.name} rejects malformed native output and recovers`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      for (const value of malformedResults(spec.name)) {
        call.mockReturnValueOnce(value);
        expect(() =>
          Reflect.apply(api[spec.name], undefined, spec.args),
        ).toThrow();
      }
      call.mockReturnValueOnce(spec.output);
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        spec.output,
      );
    });

    it(`${spec.name} preserves the original native error`, () => {
      const failure = new Error("SPICE(DEGENERATECASE)");
      const api = apiFor({
        [spec.name]: () => {
          throw failure;
        },
      });
      expect(() => Reflect.apply(api[spec.name], undefined, spec.args)).toThrow(
        failure,
      );
    });
  }

  it("owns complete array and object outputs while preserving IEEE values", () => {
    const derivatives = [NaN, Infinity, -0];
    const integral = { p: -Infinity, itgrlp: -0 };
    const derivative = { p: NaN, dpdx: Infinity };
    const roots = { root1: [-0, Infinity], root2: [NaN, -Infinity] };
    const api = apiFor({
      chbder: vi.fn().mockReturnValue(derivatives),
      polyds: vi.fn().mockReturnValue(derivatives),
      chbigr: vi.fn().mockReturnValue(integral),
      chbint: vi.fn().mockReturnValue(derivative),
      rquad: vi.fn().mockReturnValue(roots),
      chbval: vi.fn().mockReturnValue(NaN),
    });
    const outputs = [
      api.chbder(cp, x2s, 3, 2),
      api.polyds(cp, 2, 3),
      api.chbigr(cp, x2s, 3),
      api.chbint(cp, x2s, 3),
      api.rquad(1, 2, 3),
    ];
    derivatives.fill(99);
    integral.p = 99;
    integral.itgrlp = 99;
    derivative.p = 99;
    derivative.dpdx = 99;
    roots.root1.fill(99);
    roots.root2.fill(99);
    expect(outputs).toEqual([
      [NaN, Infinity, -0],
      [NaN, Infinity, -0],
      { p: -Infinity, itgrlp: -0 },
      { p: NaN, dpdx: Infinity },
      { root1: [-0, Infinity], root2: [NaN, -Infinity] },
    ]);
    expect(api.chbval(cp, x2s, 3)).toBeNaN();
  });

  it("rejects unsafe derivative orders before coefficients are accessed", () => {
    const inaccessible = new Proxy<number[]>([], {
      get() {
        throw new Error("coefficients were accessed");
      },
    });
    const chbder = vi.fn();
    const polyds = vi.fn();
    const api = apiFor({ chbder, polyds });
    for (const order of [
      -1,
      715827882,
      2147483647,
      2 ** 32,
      1.5,
      NaN,
      Infinity,
    ])
      expect(() => api.chbder(inaccessible, x2s, 3, order)).toThrow(/nderiv/);
    for (const order of [-2147483649, 2147483647, 2 ** 32, 1.5, NaN, Infinity])
      expect(() => api.polyds(inaccessible, order, 3)).toThrow(/nderiv/);
    expect(chbder).not.toHaveBeenCalled();
    expect(polyds).not.toHaveBeenCalled();
  });

  it("rejects coefficient count overflow before reading entries", () => {
    const oversized = new Proxy<number[]>([], {
      get(_target, key) {
        if (key === "length") return 2147483648;
        throw new Error("coefficient entry was accessed");
      },
    });
    for (const spec of cases) {
      if (spec.coefficientPosition === undefined) continue;
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      const args = [...spec.args];
      args[spec.coefficientPosition] = oversized;
      expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
        /coefficient count/,
      );
      expect(call).not.toHaveBeenCalled();
    }
  });

  it("requires coefficients for error-free Chebyshev evaluators but delegates defined empty cases", () => {
    const chbder = vi.fn();
    const chbint = vi.fn();
    const chbval = vi.fn();
    const failure = new Error("SPICE(INVALIDDEGREE)");
    const chbigr = vi.fn(() => {
      throw failure;
    });
    const polyds = vi
      .fn()
      .mockReturnValueOnce([0, 0, 0])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const api = apiFor({ chbder, chbint, chbval, chbigr, polyds });
    expect(() => api.chbder([], x2s, 3, 0)).toThrow(/coefficient count/);
    expect(() => api.chbint([], x2s, 3)).toThrow(/coefficient count/);
    expect(() => api.chbval([], x2s, 3)).toThrow(/coefficient count/);
    expect(chbder).not.toHaveBeenCalled();
    expect(chbint).not.toHaveBeenCalled();
    expect(chbval).not.toHaveBeenCalled();
    expect(() => api.chbigr([], x2s, 3)).toThrow(failure);
    expect(chbigr).toHaveBeenCalledWith([], x2s, 3);
    expect(api.polyds([], 2, 3)).toEqual([0, 0, 0]);
    expect(api.polyds(cp, -1, 3)).toEqual([]);
    expect(api.polyds([], -2147483648, 3)).toEqual([]);
    expect(polyds).toHaveBeenCalledTimes(3);
  });

  it("does not clamp transformation scales, normalized coordinates or trailing coefficients", () => {
    const chbval = vi.fn().mockReturnValue(0);
    const api = apiFor({ chbval });
    for (const scale of [-2, 0, 2]) {
      const coefficients = Object.freeze([1, 2, 0]);
      const transform: readonly [number, number] = [0, scale];
      api.chbval(coefficients, transform, 100);
      expect(chbval).toHaveBeenLastCalledWith(coefficients, transform, 100);
    }
  });
});

describe("actual native polynomial boundary", () => {
  const itNative = it.runIf(nodeAddonAvailable());
  itNative(
    "rejects malformed inputs and unsafe orders before scientific calls",
    () => {
      const native = getNativeAddon();
      for (const spec of cases) {
        expect(() => Reflect.apply(native[spec.name], native, [])).toThrow();
        for (const position of spec.scalarPositions) {
          const args = [...spec.args];
          args[position] = Infinity;
          expect(() =>
            Reflect.apply(native[spec.name], native, args),
          ).toThrow();
        }
        for (const position of [
          spec.coefficientPosition,
          spec.transformPosition,
        ]) {
          if (position === undefined) continue;
          const length = position === spec.transformPosition ? 2 : 3;
          const malformed: unknown[] = [
            new Array<number>(length),
            new Float64Array(length),
          ];
          for (let i = 0; i < length; i++) {
            const array = Array.from({ length }, () => 1);
            array[i] = NaN;
            malformed.push(array);
          }
          for (const value of malformed) {
            const args = [...spec.args];
            args[position] = value;
            expect(() =>
              Reflect.apply(native[spec.name], native, args),
            ).toThrow();
          }
        }
      }
      for (const order of [-1, 715827882, 1.5, NaN, Infinity])
        expect(() => native.chbder([1], [0, 1], 0, order)).toThrow();
      for (const order of [-2147483649, 2147483647, 1.5, NaN, Infinity])
        expect(() => native.polyds([1], order, 0)).toThrow();
      expect(native.chbder([1], [0, 1], 0, 2)).toEqual([1, 0, 0]);
      expect(native.polyds([], 2, 1)).toEqual([0, 0, 0]);
      expect(native.polyds([1], -2147483648, 1)).toEqual([]);
    },
  );

  itNative(
    "propagates genuine polynomial errors and resets for subsequent calls",
    () => {
      const native = getNativeAddon();
      native.reset();
      try {
        expect(() => native.chbigr([], [0, 1], 0)).toThrow(/INVALIDDEGREE/);
        expect(native.failed()).toBe(false);
        expect(() => native.chbigr([1], [0, 0], 0)).toThrow(/INVALIDRADIUS/);
        expect(native.failed()).toBe(false);
        expect(native.chbigr([1], [0, 1], 0)).toEqual({ p: 1, itgrlp: 0 });
        expect(() => native.rquad(0, 0, 1)).toThrow(/DEGENERATECASE/);
        expect(native.failed()).toBe(false);
        expect(native.rquad(0, 2, -6)).toEqual({
          root1: [3, 0],
          root2: [3, 0],
        });
      } finally {
        native.reset();
      }
    },
  );
});

it("reads every polynomial coefficient and transform entry once before native delegation", () => {
  function once(values: readonly number[]): number[] {
    const input: number[] = [];
    for (const [index, value] of values.entries()) {
      let read = false;
      Object.defineProperty(input, index, {
        configurable: true,
        get() {
          if (read) throw new Error("input entry read twice");
          read = true;
          return value;
        },
      });
    }
    return input;
  }
  for (const spec of cases) {
    if (spec.name === "rquad") continue;
    const coefficients = once([1, -2, 3]);
    const transform = once([7, -5]);
    const args = [...spec.args];
    args[0] = coefficients;
    if (spec.transformPosition !== undefined)
      args[spec.transformPosition] = transform;
    const call = vi.fn((...received: unknown[]) => {
      expect(received[0]).not.toBe(coefficients);
      expect(received[0]).toEqual([1, -2, 3]);
      if (spec.transformPosition !== undefined) {
        expect(received[spec.transformPosition]).not.toBe(transform);
        expect(received[spec.transformPosition]).toEqual([7, -5]);
      }
      return spec.output;
    });
    const api = apiFor({ [spec.name]: call });
    expect(Reflect.apply(api[spec.name], undefined, args)).toEqual(spec.output);
    expect(call).toHaveBeenCalledOnce();
  }
});

it("rejects a coefficient disappearing mid-copy without calling native code", () => {
  const coefficients = [1, 2];
  Object.defineProperty(coefficients, 0, {
    get() {
      coefficients.length = 1;
      return 1;
    },
  });
  const chbval = vi.fn();
  const api = apiFor({ chbval });
  expect(() => api.chbval(coefficients, [0, 1], 0)).toThrow(/finite number/);
  expect(chbval).not.toHaveBeenCalled();
});
