import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

type Method = "ducrss" | "dvcrss" | "dvdot" | "dvhat" | "dvnorm" | "dvsep";
const first = Object.freeze([1, -2, 3, -4, 5, -6] as const);
const second = Object.freeze([7, 11, -13, 17, -19, 23] as const);
const calls: readonly {
  name: Method;
  args: readonly unknown[];
  state: boolean;
}[] = [
  { name: "ducrss", args: [first, second], state: true },
  { name: "dvcrss", args: [first, second], state: true },
  { name: "dvdot", args: [first, second], state: false },
  { name: "dvhat", args: [first], state: true },
  { name: "dvnorm", args: [first], state: false },
  { name: "dvsep", args: [first, second], state: false },
];

function apiFor(native: Partial<NativeAddon>) {
  // Each test calls only its configured mock; this contained partial-addon
  // assertion permits malformed native output without weakening production.
  return createCoordsVectorsApi(native as NativeAddon);
}

function resultFor(state: boolean): unknown {
  return state ? [11, -23, 37, -41, 53, -67] : -17.25;
}

describe("native state-derivative boundary", () => {
  for (const spec of calls) {
    it(`${spec.name} preserves argument order, readonly inputs and all six output components`, () => {
      const call = vi.fn().mockReturnValue(resultFor(spec.state));
      const api = apiFor({ [spec.name]: call });
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        resultFor(spec.state),
      );
      expect(call).toHaveBeenCalledOnce();
      expect(call).toHaveBeenCalledWith(...spec.args);
      expect(first).toEqual([1, -2, 3, -4, 5, -6]);
      expect(second).toEqual([7, 11, -13, 17, -19, 23]);
    });

    it(`${spec.name} requires exactly six finite entries in every state`, () => {
      const call = vi.fn().mockReturnValue(resultFor(spec.state));
      const api = apiFor({ [spec.name]: call });
      const invalid: unknown[] = [
        null,
        undefined,
        {},
        "1",
        [],
        [1, 2, 3],
        [1, 2, 3, 4, 5],
        [1, 2, 3, 4, 5, 6, 7],
        new Float64Array(first),
        new BigInt64Array(6),
        Object.assign(new Array<number>(6), { 0: 1, 5: 6 }),
      ];
      for (let i = 0; i < 6; i++)
        for (const value of [
          NaN,
          Infinity,
          -Infinity,
          "1",
          null,
          undefined,
          1n,
        ]) {
          const input: unknown[] = [...first];
          input[i] = value;
          invalid.push(input);
        }
      for (let position = 0; position < spec.args.length; position++)
        for (const value of invalid) {
          const args = [...spec.args];
          args[position] = value;
          expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
            TypeError,
          );
        }
      expect(call).not.toHaveBeenCalled();
    });

    it(`${spec.name} rejects malformed native output and recovers`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      const invalid: unknown[] = [null, undefined, {}, [], "1", 1n];
      if (spec.state) {
        invalid.push(
          [1, 2, 3, 4, 5],
          [1, 2, 3, 4, 5, 6, 7],
          new Float64Array(6),
          Object.assign(new Array<number>(6), { 0: 1, 5: 6 }),
        );
        for (let i = 0; i < 6; i++) {
          const value: unknown[] = [...first];
          value[i] = "1";
          invalid.push(value);
        }
      }
      for (const output of invalid) {
        call.mockReturnValueOnce(output);
        expect(() =>
          Reflect.apply(api[spec.name], undefined, spec.args),
        ).toThrow(TypeError);
      }
      call.mockReturnValueOnce(resultFor(spec.state));
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        resultFor(spec.state),
      );
    });

    if (spec.state) {
      it(`${spec.name} owns its result and retains native IEEE values in both state halves`, () => {
        const native = [NaN, Infinity, -0, -Infinity, NaN, -0];
        const call = vi.fn().mockReturnValue(native);
        const api = apiFor({ [spec.name]: call });
        const result = Reflect.apply(api[spec.name], undefined, spec.args);
        native.fill(99);
        expect(result).toEqual([NaN, Infinity, -0, -Infinity, NaN, -0]);
      });
    } else {
      it(`${spec.name} retains native IEEE scalar results`, () => {
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

    it(`${spec.name} propagates the original native error without substituting zero`, () => {
      const failure = new Error("SPICE(NUMERICOVERFLOW)");
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
});

describe("actual native state-derivative boundary", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative(
    "direct addon rejects short, sparse and nonfinite states before C",
    () => {
      const native = getNativeAddon();
      for (const spec of calls) {
        for (let position = 0; position < spec.args.length; position++) {
          for (const value of [
            [1, 2, 3],
            [1, 2, 3, 4, 5, Infinity],
            [1, 2, NaN, 4, 5, 6],
            Object.assign(new Array<number>(6), { 0: 1, 5: 6 }),
          ]) {
            const args = [...spec.args];
            args[position] = value;
            expect(() =>
              Reflect.apply(native[spec.name], native, args),
            ).toThrow();
          }
        }
        expect(() =>
          Reflect.apply(native[spec.name], native, spec.args),
        ).not.toThrow();
      }
    },
  );

  itNative(
    "dvsep propagates a genuine guarded-division error and resets for the next call",
    () => {
      const native = getNativeAddon();
      native.reset();
      try {
        // All intermediates can remain finite; N0067 ZZDIV's decimal exponent
        // guard rejects this rate above 1e308 as SPICE(NUMERICOVERFLOW).
        expect(() =>
          native.dvsep([1, 0, 0, 0, 1.5e308, 0], [0, 1, 0, 0, 0, 0]),
        ).toThrow(/NUMERICOVERFLOW/);
        expect(native.failed()).toBe(false);
        expect(native.dvsep([1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, 0])).toBe(-1);
      } finally {
        native.reset();
      }
    },
  );
});
