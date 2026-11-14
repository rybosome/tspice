import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

type Method = "hrmesp" | "hrmint" | "lgresp" | "lgrind" | "lgrint" | "qderiv";
const xvals = Object.freeze([-3, 2]);
const yvals = Object.freeze([7, -11]);
const hermite = Object.freeze([7, 13, -11, 17]);
const cases: readonly {
  name: Method;
  args: readonly unknown[];
  arrays: readonly { position: number; stride: number }[];
  scalars: readonly number[];
  maximum: number;
  output: unknown;
}[] = [
  {
    name: "hrmesp",
    args: [-3, 5, hermite, 1],
    arrays: [{ position: 2, stride: 2 }],
    scalars: [0, 1, 3],
    maximum: 67108863,
    output: { f: 19, df: -23 },
  },
  {
    name: "hrmint",
    args: [xvals, hermite, 1],
    arrays: [
      { position: 0, stride: 1 },
      { position: 1, stride: 2 },
    ],
    scalars: [2],
    maximum: 357913941,
    output: { f: 19, df: -23 },
  },
  {
    name: "lgresp",
    args: [-3, 5, yvals, 1],
    arrays: [{ position: 2, stride: 1 }],
    scalars: [0, 1, 3],
    maximum: 268435455,
    output: 19,
  },
  {
    name: "lgrind",
    args: [xvals, yvals, 1],
    arrays: [
      { position: 0, stride: 1 },
      { position: 1, stride: 1 },
    ],
    scalars: [2],
    maximum: 715827882,
    output: { p: 19, dp: -23 },
  },
  {
    name: "lgrint",
    args: [xvals, yvals, 1],
    arrays: [
      { position: 0, stride: 1 },
      { position: 1, stride: 1 },
    ],
    scalars: [2],
    maximum: 268435455,
    output: 19,
  },
  {
    name: "qderiv",
    args: [xvals, yvals, 3],
    arrays: [
      { position: 0, stride: 1 },
      { position: 1, stride: 1 },
    ],
    scalars: [2],
    maximum: 2147483646,
    output: [19, -23],
  },
];

function apiFor(native: Partial<NativeAddon>) {
  // Each test uses only its configured mock; the contained assertion also
  // permits deliberately malformed native output without weakening production.
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
  const values: unknown[] = [
    null,
    undefined,
    "1",
    1n,
    {},
    new DataView(new ArrayBuffer(16)),
  ];
  if (name === "qderiv")
    values.push(
      [],
      [1],
      [1, 2, 3],
      [1, "2"],
      [1n, 2],
      new Array<number>(2),
      new Float64Array(2),
      new BigInt64Array(2),
    );
  else if (name === "hrmesp" || name === "hrmint")
    values.push({ f: 1 }, { df: 1 }, { f: "1", df: 1 }, { f: 1, df: 1n });
  else if (name === "lgrind")
    values.push({ p: 1 }, { dp: 1 }, { p: "1", dp: 1 }, { p: 1, dp: 1n });
  else values.push([]);
  return values;
}

function mutatingPair(hermiteValues: boolean): {
  first: number[];
  second: number[];
} {
  const second = hermiteValues ? [0, 0, 1, 2] : [0, 1];
  const first = [0, 1];
  Object.defineProperty(first, 0, {
    get() {
      second.length = 0;
      return 0;
    },
  });
  return { first, second };
}

describe("native interpolation adapter boundary", () => {
  for (const spec of cases) {
    it(`${spec.name} preserves argument order and copies readonly inputs`, () => {
      const call = vi.fn().mockReturnValue(spec.output);
      const api = apiFor({ [spec.name]: call });
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        spec.output,
      );
      expect(call).toHaveBeenCalledOnce();
      expect(call).toHaveBeenCalledWith(...spec.args);
      for (const { position } of spec.arrays)
        expect(call.mock.calls[0]?.[position]).not.toBe(spec.args[position]);
      expect(xvals).toEqual([-3, 2]);
      expect(yvals).toEqual([7, -11]);
      expect(hermite).toEqual([7, 13, -11, 17]);
    });

    it(`${spec.name} validates all scalars and every array entry before delegation`, () => {
      const call = vi.fn().mockReturnValue(spec.output);
      const api = apiFor({ [spec.name]: call });
      for (const position of spec.scalars)
        for (const value of invalidNumbers) {
          const args = [...spec.args];
          args[position] = value;
          expect(() =>
            Reflect.apply(api[spec.name], undefined, args),
          ).toThrow();
        }
      for (const { position, stride } of spec.arrays) {
        const length = stride * 2;
        const invalid: unknown[] = [
          null,
          {},
          "1",
          new Float64Array(length),
          new BigInt64Array(length),
          new DataView(new ArrayBuffer(16)),
          new Array<number>(length),
        ];
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

    it(`${spec.name} rejects dimensions beyond its pinned source limit before entry access`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      for (const { position, stride } of spec.arrays) {
        const oversized = new Proxy<number[]>([], {
          get(_target, key) {
            if (key === "length") return (spec.maximum + 1) * stride;
            throw new Error("array entry was accessed");
          },
        });
        const args = [...spec.args];
        args[position] = oversized;
        expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
          /point count/,
        );
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

    it(`${spec.name} propagates the original native error`, () => {
      const failure = new Error("SPICE(DIVIDEBYZERO)");
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

  it("rejects incomplete Hermite pairs and mismatched array lengths", () => {
    for (const spec of cases) {
      if (spec.arrays.length === 1 && spec.name !== "hrmesp") continue;
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      const args = [...spec.args];
      const last = spec.arrays[spec.arrays.length - 1]!;
      args[last.position] = last.stride === 2 ? [1, 2, 3] : [1];
      expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
        /layout|length/,
      );
      expect(call).not.toHaveBeenCalled();
    }
  });

  it("delegates empty interpolators but rejects the nonportable empty qderiv domain", () => {
    for (const spec of cases) {
      const failure = new Error("SPICE(INVALIDSIZE)");
      const call = vi.fn(() => {
        throw failure;
      });
      const api = apiFor({ [spec.name]: call });
      const args = [...spec.args];
      for (const { position } of spec.arrays) args[position] = [];
      if (spec.name === "qderiv") {
        expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
          /nonempty/,
        );
        expect(call).not.toHaveBeenCalled();
      } else {
        expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
          failure,
        );
        expect(call).toHaveBeenCalledOnce();
      }
    }
  });

  it("owns multi-value outputs and retains all native IEEE values", () => {
    const hermiteResult = { f: NaN, df: -0 };
    const lagrangeResult = { p: Infinity, dp: -Infinity };
    const vectorResult = [-0, NaN];
    const api = apiFor({
      hrmesp: vi.fn().mockReturnValue(hermiteResult),
      hrmint: vi.fn().mockReturnValue(hermiteResult),
      lgrind: vi.fn().mockReturnValue(lagrangeResult),
      qderiv: vi.fn().mockReturnValue(vectorResult),
      lgresp: vi.fn().mockReturnValue(-0),
      lgrint: vi.fn().mockReturnValue(Infinity),
    });
    const results = [
      api.hrmesp(-3, 5, hermite, 1),
      api.hrmint(xvals, hermite, 1),
      api.lgrind(xvals, yvals, 1),
      api.qderiv(xvals, yvals, 3),
    ];
    hermiteResult.f = 99;
    hermiteResult.df = 99;
    lagrangeResult.p = 99;
    lagrangeResult.dp = 99;
    vectorResult.fill(99);
    expect(results).toEqual([
      { f: NaN, df: -0 },
      { f: NaN, df: -0 },
      { p: Infinity, dp: -Infinity },
      [-0, NaN],
    ]);
    expect(Object.is(api.lgresp(-3, 5, yvals, 1), -0)).toBe(true);
    expect(api.lgrint(xvals, yvals, 1)).toBe(Infinity);
  });

  it("preserves finite zero/negative steps, extrapolation and duplicate input order", () => {
    const hrmesp = vi.fn().mockReturnValue({ f: 0, df: 0 });
    const lgresp = vi.fn().mockReturnValue(0);
    const qderiv = vi.fn().mockReturnValue([0, 0]);
    const lgrint = vi.fn().mockReturnValue(0);
    const api = apiFor({ hrmesp, lgresp, qderiv, lgrint });
    for (const step of [0, -3]) {
      api.hrmesp(7, step, hermite, 100);
      expect(hrmesp).toHaveBeenLastCalledWith(7, step, hermite, 100);
      api.lgresp(7, step, yvals, 100);
      expect(lgresp).toHaveBeenLastCalledWith(7, step, yvals, 100);
      api.qderiv(xvals, yvals, step);
      expect(qderiv).toHaveBeenLastCalledWith(xvals, yvals, step);
    }
    api.lgrint([3, 1, 3], [4, 5, 6], 100);
    expect(lgrint).toHaveBeenCalledWith([3, 1, 3], [4, 5, 6], 100);
  });

  for (const name of ["hrmint", "lgrind", "lgrint", "qderiv"] as const) {
    it(`${name} rejects an accessor shrinking the second array after count validation`, () => {
      const { first, second } = mutatingPair(name === "hrmint");
      const call = vi.fn();
      const api = apiFor({ [name]: call });
      expect(() => api[name](first, second, 1)).toThrow(/finite number/);
      expect(call).not.toHaveBeenCalled();
    });
  }
});

describe("actual native interpolation boundary", () => {
  const itNative = it.runIf(nodeAddonAvailable());
  itNative(
    "rejects malformed arrays and scalars before scientific calls",
    () => {
      const native = getNativeAddon();
      for (const spec of cases) {
        expect(() => Reflect.apply(native[spec.name], native, [])).toThrow();
        for (const position of spec.scalars) {
          const args = [...spec.args];
          args[position] = Infinity;
          expect(() =>
            Reflect.apply(native[spec.name], native, args),
          ).toThrow();
        }
        for (const { position, stride } of spec.arrays) {
          const invalid: unknown[] = [
            new Float64Array(stride * 2),
            new Array<number>(stride * 2),
          ];
          for (let i = 0; i < stride * 2; i++) {
            const array = Array.from({ length: stride * 2 }, () => 1);
            array[i] = NaN;
            invalid.push(array);
          }
          for (const value of invalid) {
            const args = [...spec.args];
            args[position] = value;
            expect(() =>
              Reflect.apply(native[spec.name], native, args),
            ).toThrow();
          }
        }
      }
      expect(() => native.hrmesp(0, 1, [1, 2, 3], 0)).toThrow();
      expect(() => native.hrmint([0, 1], [1, 2], 0)).toThrow();
      expect(() => native.qderiv([], [], 1)).toThrow(/nonempty/);
      expect(() => native.qderiv([1], [1, 2], 1)).toThrow(/length/);
    },
  );

  itNative(
    "copies exactly validated counts when an accessor shrinks a paired input",
    () => {
      const native = getNativeAddon();
      for (const name of ["hrmint", "lgrind", "lgrint", "qderiv"] as const) {
        const { first, second } = mutatingPair(name === "hrmint");
        expect(() => native[name](first, second, 1)).toThrow(/finite number/);
      }
      expect(native.qderiv([1, 3], [5, 11], 2)).toEqual([1, 2]);
    },
  );

  itNative(
    "propagates genuine size, spacing and duplicate-point errors and recovers",
    () => {
      const native = getNativeAddon();
      native.reset();
      try {
        for (const spec of cases) {
          if (spec.name === "qderiv") continue;
          const args = [...spec.args];
          for (const { position } of spec.arrays) args[position] = [];
          expect(() => Reflect.apply(native[spec.name], native, args)).toThrow(
            /INVALIDSIZE/,
          );
          expect(native.failed()).toBe(false);
        }
        expect(() => native.hrmesp(0, 0, [0, 0, 4, 4], 1)).toThrow(
          /INVALIDSTEPSIZE/,
        );
        expect(() => native.lgresp(0, 0, [0, 1, 4], 1)).toThrow(
          /INVALIDSTEPSIZE/,
        );
        expect(() => native.hrmint([0, 0], [0, 0, 4, 4], 1)).toThrow(
          /DIVIDEBYZERO/,
        );
        expect(() => native.lgrind([0, 0], [0, 1], 1)).toThrow(/DIVIDEBYZERO/);
        expect(() => native.lgrint([0, 0], [0, 1], 1)).toThrow(/DIVIDEBYZERO/);
        expect(() => native.qderiv([1], [2], 0)).toThrow(/DIVIDEBYZERO/);
        expect(native.failed()).toBe(false);
        expect(native.hrmesp(0, 2, [0, 0, 4, 4], 1)).toEqual({ f: 1, df: 2 });
        expect(native.hrmint([0, 2], [0, 0, 4, 4], 1)).toEqual({ f: 1, df: 2 });
        expect(native.lgresp(0, 1, [0, 1, 4], 0.5)).toBe(0.25);
        expect(native.lgrind([0, 1, 2], [0, 1, 4], 0.5)).toEqual({
          p: 0.25,
          dp: 1,
        });
        expect(native.lgrint([0, 1, 2], [0, 1, 4], 0.5)).toBe(0.25);
        expect(native.qderiv([1, 3], [5, 11], 2)).toEqual([1, 2]);
      } finally {
        native.reset();
      }
    },
  );
});
