import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

type Method =
  | "brcktd"
  | "brckti"
  | "convrt"
  | "sumad"
  | "sumai"
  | "maxd"
  | "maxi"
  | "mind"
  | "mini";
const values = Object.freeze([-3, 5, -7] as const);
const calls: readonly {
  name: Method;
  args: readonly unknown[];
  scalars: readonly number[];
  integer: boolean;
  array?: boolean;
  extrema?: boolean;
}[] = [
  { name: "brcktd", args: [3.5, 8, -4], scalars: [0, 1, 2], integer: false },
  { name: "brckti", args: [3, 8, -4], scalars: [0, 1, 2], integer: true },
  { name: "convrt", args: [-5, "kM", " meters"], scalars: [0], integer: false },
  { name: "sumad", args: [values], scalars: [], integer: false, array: true },
  { name: "sumai", args: [values], scalars: [], integer: true, array: true },
  {
    name: "maxd",
    args: [values],
    scalars: [],
    integer: false,
    array: true,
    extrema: true,
  },
  {
    name: "maxi",
    args: [values],
    scalars: [],
    integer: true,
    array: true,
    extrema: true,
  },
  {
    name: "mind",
    args: [values],
    scalars: [],
    integer: false,
    array: true,
    extrema: true,
  },
  {
    name: "mini",
    args: [values],
    scalars: [],
    integer: true,
    array: true,
    extrema: true,
  },
];

function apiFor(native: Partial<NativeAddon>) {
  // Tests invoke only the configured mock; the partial-addon assertion permits
  // deliberate malformed results without weakening production types.
  return createCoordsVectorsApi(native as NativeAddon);
}

describe("native scalar-math boundary", () => {
  for (const spec of calls) {
    const output = spec.integer ? 17 : 17.25;
    it(`${spec.name} preserves argument order and returns the native result`, () => {
      const call = vi.fn().mockReturnValue(output);
      const api = apiFor({ [spec.name]: call });
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toBe(output);
      expect(call).toHaveBeenCalledOnce();
      expect(call).toHaveBeenCalledWith(...spec.args);
      expect(values).toEqual([-3, 5, -7]);
    });

    if (spec.scalars.length) {
      it(`${spec.name} validates every scalar before native execution`, () => {
        const call = vi.fn().mockReturnValue(output);
        const api = apiFor({ [spec.name]: call });
        const invalid: unknown[] = [
          NaN,
          Infinity,
          -Infinity,
          "1",
          null,
          undefined,
          1n,
        ];
        if (spec.integer) invalid.push(0.5, -2147483649, 2147483648);
        for (const position of spec.scalars)
          for (const value of invalid) {
            const args = [...spec.args];
            args[position] = value;
            expect(() =>
              Reflect.apply(api[spec.name], undefined, args),
            ).toThrow();
          }
        expect(call).not.toHaveBeenCalled();
      });
    }

    if (spec.array) {
      it(`${spec.name} validates dense numeric arrays before native execution`, () => {
        const call = vi.fn().mockReturnValue(output);
        const api = apiFor({ [spec.name]: call });
        const invalid: unknown[] = [
          null,
          {},
          "1",
          new Float64Array([1, 2]),
          new Int32Array([1, 2]),
          new BigInt64Array(2),
          Object.assign(new Array<number>(3), { 0: 1, 2: 3 }),
        ];
        const invalidValues: unknown[] = [
          NaN,
          Infinity,
          -Infinity,
          "1",
          null,
          undefined,
          1n,
        ];
        if (spec.integer) invalidValues.push(0.5, -2147483649, 2147483648);
        for (let i = 0; i < 3; i++)
          for (const value of invalidValues) {
            const input: unknown[] = [...values];
            input[i] = value;
            invalid.push(input);
          }
        for (const input of invalid)
          expect(() =>
            Reflect.apply(api[spec.name], undefined, [input]),
          ).toThrow();
        expect(call).not.toHaveBeenCalled();
      });

      it(`${spec.name} enforces its count bound before reading entries`, () => {
        const call = vi.fn().mockReturnValue(output);
        const api = apiFor({ [spec.name]: call });
        // Large sparse arrays occupy no dense data buffer; count validation
        // must reject these before inspecting entries or calling native.
        const input = new Array<number>(spec.extrema ? 31 : 2147483648);
        expect(() => Reflect.apply(api[spec.name], undefined, [input])).toThrow(
          RangeError,
        );
        expect(call).not.toHaveBeenCalled();
      });

      it(`${spec.name} forwards empty, singleton and every portable variadic length unchanged`, () => {
        const call = vi.fn().mockReturnValue(output);
        const api = apiFor({ [spec.name]: call });
        for (let count = 0; count <= 30; count++) {
          const input = Object.freeze(
            Array.from({ length: count }, (_, i) => i - 10),
          );
          expect(Reflect.apply(api[spec.name], undefined, [input])).toBe(
            output,
          );
          expect(call).toHaveBeenLastCalledWith(input);
        }
        if (!spec.extrema) {
          const input = Object.freeze(new Array<number>(31).fill(1));
          Reflect.apply(api[spec.name], undefined, [input]);
          expect(call).toHaveBeenLastCalledWith(input);
        }
      });
    }

    it(`${spec.name} rejects malformed native results and recovers`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      const invalid: unknown[] = [null, undefined, {}, [], "1", 1n];
      if (spec.integer)
        invalid.push(NaN, Infinity, -Infinity, 0.5, -2147483649, 2147483648);
      for (const value of invalid) {
        call.mockReturnValueOnce(value);
        expect(() =>
          Reflect.apply(api[spec.name], undefined, spec.args),
        ).toThrow();
      }
      call.mockReturnValueOnce(output);
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toBe(output);
    });

    if (!spec.integer) {
      it(`${spec.name} preserves native nonfinite results and signed zero`, () => {
        const call = vi.fn();
        const api = apiFor({ [spec.name]: call });
        for (const value of [NaN, Infinity, -Infinity, -0, 0]) {
          call.mockReturnValueOnce(value);
          expect(
            Object.is(
              Reflect.apply(api[spec.name], undefined, spec.args),
              value,
            ),
          ).toBe(true);
        }
      });
    }

    it(`${spec.name} propagates the original native failure`, () => {
      const failure = new Error("SPICE(scalar math failure)");
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

  it("convrt validates both strings without trimming or normalizing accepted input", () => {
    const call = vi.fn().mockReturnValue(3);
    const api = apiFor({ convrt: call });
    for (const position of [1, 2])
      for (const value of [null, undefined, 3, {}, ["KM"], "KM\0M", "\0"]) {
        const args: unknown[] = [1, "KM", "M"];
        args[position] = value;
        expect(() => Reflect.apply(api.convrt, undefined, args)).toThrow(
          TypeError,
        );
      }
    expect(call).not.toHaveBeenCalled();
    for (const input of ["", " ", " km ", "kM", "天体"]) {
      api.convrt(-5, input, " M ");
      expect(call).toHaveBeenLastCalledWith(-5, input, " M ");
    }
  });

  it("sumai rejects every overflowing prefix, even if the mathematical final sum fits", () => {
    const call = vi.fn().mockReturnValue(123);
    const api = apiFor({ sumai: call });
    for (const input of [
      [2147483647, 1],
      [-2147483648, -1],
      [2147483647, 1, -1],
      [-2147483648, -1, 1],
      [2147483647, 2147483647, -2147483647],
    ])
      expect(() => api.sumai(input)).toThrow(RangeError);
    expect(call).not.toHaveBeenCalled();
    for (const input of [
      [2147483647],
      [-2147483648],
      [2147483647, -2147483648],
      [-2147483648, 2147483647],
      [2147483647, -2147483647, 1],
    ]) {
      expect(api.sumai(Object.freeze(input))).toBe(123);
      expect(call).toHaveBeenLastCalledWith(input);
    }
  });
});

describe("actual native scalar safety boundary", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative(
    "shared C rejects sumai prefix overflow before CSPICE and recovers",
    () => {
      const native = getNativeAddon();
      native.reset();
      try {
        // Calling the addon directly bypasses the JS prefix guard. These inputs
        // must stop in the shared-C guard; never pass them to unguarded sumai_c.
        for (const input of [
          [2147483647, 1, -1],
          [-2147483648, -1, 1],
        ]) {
          expect(() => native.sumai(input)).toThrow(/prefix sums must fit/);
          expect(native.failed()).toBe(false);
          expect(native.sumai([2147483647, -2147483648])).toBe(-1);
        }
      } finally {
        native.reset();
      }
    },
  );

  itNative(
    "direct addon validates integer arrays and variadic limits before C dispatch",
    () => {
      const native = getNativeAddon();
      for (const name of ["maxi", "mini", "sumai"] as const) {
        for (const input of [
          [0.5],
          [2147483648],
          [-2147483649],
          [NaN],
          Object.assign(new Array<number>(3), { 0: 1, 2: 3 }),
        ])
          expect(() => native[name](input)).toThrow();
        expect(native[name]([])).toBe(0);
      }
      for (const name of ["maxd", "maxi", "mind", "mini"] as const) {
        expect(() => native[name](new Array<number>(31).fill(1))).toThrow();
        expect(native[name]([7])).toBe(7);
      }
    },
  );
});
