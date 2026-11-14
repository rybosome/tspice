import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

type Method =
  | "vaddg"
  | "vdistg"
  | "vdotg"
  | "vequg"
  | "vhatg"
  | "vlcomg"
  | "vminug"
  | "vnormg"
  | "vprojg"
  | "vrelg"
  | "vsclg"
  | "vsepg"
  | "vsubg"
  | "vzerog"
  | "unormg";
type Output = "vector" | "number" | "boolean" | "unit";
const first = Object.freeze([1, -2, 3, -4, 5] as const);
const second = Object.freeze([-7, 11, -13, 17, -19] as const);
const calls: readonly {
  name: Method;
  args: readonly unknown[];
  vectors: readonly number[];
  scalars?: readonly number[];
  output: Output;
}[] = [
  { name: "vaddg", args: [first, second], vectors: [0, 1], output: "vector" },
  { name: "vdistg", args: [first, second], vectors: [0, 1], output: "number" },
  { name: "vdotg", args: [first, second], vectors: [0, 1], output: "number" },
  { name: "vequg", args: [first], vectors: [0], output: "vector" },
  { name: "vhatg", args: [first], vectors: [0], output: "vector" },
  {
    name: "vlcomg",
    args: [2, first, -3, second],
    vectors: [1, 3],
    scalars: [0, 2],
    output: "vector",
  },
  { name: "vminug", args: [first], vectors: [0], output: "vector" },
  { name: "vnormg", args: [first], vectors: [0], output: "number" },
  { name: "vprojg", args: [first, second], vectors: [0, 1], output: "vector" },
  { name: "vrelg", args: [first, second], vectors: [0, 1], output: "number" },
  {
    name: "vsclg",
    args: [2, first],
    vectors: [1],
    scalars: [0],
    output: "vector",
  },
  { name: "vsepg", args: [first, second], vectors: [0, 1], output: "number" },
  { name: "vsubg", args: [first, second], vectors: [0, 1], output: "vector" },
  { name: "vzerog", args: [first], vectors: [0], output: "boolean" },
  { name: "unormg", args: [first], vectors: [0], output: "unit" },
];

function apiFor(native: Partial<NativeAddon>) {
  // Only configured mocks are invoked; this contained partial-addon assertion
  // permits deliberate malformed outputs while production remains fully typed.
  return createCoordsVectorsApi(native as NativeAddon);
}

function resultFor(kind: Output, dimension = 5): unknown {
  const vector = Array.from({ length: dimension }, (_, i) => 11 + i * 3);
  if (kind === "vector") return vector;
  if (kind === "number") return 17.25;
  if (kind === "boolean") return true;
  return { unit: vector, norm: 23.5 };
}

function syntheticLength(length: number): readonly number[] {
  // No giant backing store is created. Any attempted entry read fails so this
  // fixture proves dimension rejection occurs before traversal or native calls.
  return new Proxy<number[]>([], {
    get(_target, key) {
      if (key === "length") return length;
      throw new Error(
        "Synthetic dimension must be rejected before entry access",
      );
    },
  });
}

describe("native general-vector boundary", () => {
  for (const spec of calls) {
    it(`${spec.name} preserves argument order, readonly vectors and complete native output`, () => {
      const call = vi.fn().mockReturnValue(resultFor(spec.output));
      const api = apiFor({ [spec.name]: call });
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        resultFor(spec.output),
      );
      expect(call).toHaveBeenCalledOnce();
      expect(call).toHaveBeenCalledWith(...spec.args);
      expect(first).toEqual([1, -2, 3, -4, 5]);
      expect(second).toEqual([-7, 11, -13, 17, -19]);
    });

    it(`${spec.name} validates every vector component before native execution`, () => {
      const call = vi.fn().mockReturnValue(resultFor(spec.output));
      const api = apiFor({ [spec.name]: call });
      const invalid: unknown[] = [
        null,
        undefined,
        {},
        "1",
        new Float64Array(first),
        new BigInt64Array(5),
        Object.assign(new Array<number>(5), { 0: 1, 4: 5 }),
      ];
      for (let i = 0; i < 5; i++)
        for (const value of [NaN, Infinity, -Infinity, "1", undefined, 1n]) {
          const input: unknown[] = [...first];
          input[i] = value;
          invalid.push(input);
        }
      for (const position of spec.vectors)
        for (const value of invalid) {
          const args = [...spec.args];
          args[position] = value;
          expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
            TypeError,
          );
        }
      expect(call).not.toHaveBeenCalled();
    });

    if (spec.vectors.length > 1) {
      it(`${spec.name} rejects mismatched dimensions in either vector`, () => {
        const call = vi.fn().mockReturnValue(resultFor(spec.output));
        const api = apiFor({ [spec.name]: call });
        for (const position of spec.vectors)
          for (const value of [[], [1], [1, 2, 3, 4], [1, 2, 3, 4, 5, 6]]) {
            const args = [...spec.args];
            args[position] = value;
            expect(() =>
              Reflect.apply(api[spec.name], undefined, args),
            ).toThrow(RangeError);
          }
        expect(call).not.toHaveBeenCalled();
      });
    }

    if (spec.scalars) {
      it(`${spec.name} validates every coefficient before native execution`, () => {
        const call = vi.fn().mockReturnValue(resultFor(spec.output));
        const api = apiFor({ [spec.name]: call });
        for (const position of spec.scalars!)
          for (const value of [NaN, Infinity, -Infinity, "1", undefined, 1n]) {
            const args = [...spec.args];
            args[position] = value;
            expect(() =>
              Reflect.apply(api[spec.name], undefined, args),
            ).toThrow(TypeError);
          }
        expect(call).not.toHaveBeenCalled();
      });
    }

    it(`${spec.name} rejects oversized dimensions before reading entries`, () => {
      const call = vi.fn().mockReturnValue(resultFor(spec.output));
      const api = apiFor({ [spec.name]: call });
      const prohibited =
        spec.name === "vprojg" || spec.name === "unormg"
          ? 2147483647
          : 2147483648;
      for (const position of spec.vectors) {
        const args = [...spec.args];
        args[position] = syntheticLength(prohibited);
        expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
          RangeError,
        );
      }
      expect(call).not.toHaveBeenCalled();
    });

    it(`${spec.name} forwards empty, singleton and larger dimensions to native`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      for (const dimension of [0, 1, 2, 3, 7, 17]) {
        const vector = Object.freeze(
          Array.from({ length: dimension }, (_, i) => i - 4),
        );
        const args = [...spec.args];
        for (const position of spec.vectors) args[position] = vector;
        call.mockReturnValueOnce(resultFor(spec.output, dimension));
        expect(Reflect.apply(api[spec.name], undefined, args)).toEqual(
          resultFor(spec.output, dimension),
        );
        expect(call).toHaveBeenLastCalledWith(...args);
      }
    });

    it(`${spec.name} rejects malformed native output and recovers`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      const invalid: unknown[] = [null, undefined, {}, "1", 1n];
      if (spec.output === "vector")
        invalid.push(
          [],
          [1, 2, 3, 4],
          [1, 2, 3, 4, 5, 6],
          [1, 2, "3", 4, 5],
          new Float64Array(5),
          Object.assign(new Array<number>(5), { 0: 1, 4: 5 }),
        );
      if (spec.output === "unit")
        invalid.push(
          [],
          { unit: [1, 2, 3, 4, 5] },
          { unit: [1, 2, 3], norm: 4 },
          { unit: [1, 2, "3", 4, 5], norm: 4 },
          { unit: [1, 2, 3, 4, 5], norm: "4" },
        );
      if (spec.output === "boolean") invalid.push(0, 1, []);
      if (spec.output === "number") invalid.push([]);
      for (const value of invalid) {
        call.mockReturnValueOnce(value);
        expect(() =>
          Reflect.apply(api[spec.name], undefined, spec.args),
        ).toThrow();
      }
      call.mockReturnValueOnce(resultFor(spec.output));
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        resultFor(spec.output),
      );
    });

    if (spec.output === "vector" || spec.output === "unit") {
      it(`${spec.name} owns every output component and preserves IEEE values`, () => {
        const nativeVector = [NaN, Infinity, -Infinity, -0, 17];
        const native =
          spec.output === "unit"
            ? { unit: nativeVector, norm: Infinity }
            : nativeVector;
        const call = vi.fn().mockReturnValue(native);
        const api = apiFor({ [spec.name]: call });
        const result = Reflect.apply(api[spec.name], undefined, spec.args);
        nativeVector.fill(99);
        if (!Array.isArray(native)) native.norm = -7;
        expect(result).toEqual(
          spec.output === "unit"
            ? { unit: [NaN, Infinity, -Infinity, -0, 17], norm: Infinity }
            : [NaN, Infinity, -Infinity, -0, 17],
        );
      });
    } else if (spec.output === "number") {
      it(`${spec.name} preserves native scalar IEEE values`, () => {
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
      const failure = new Error("SPICE(general vector failure)");
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

describe("actual native general-vector boundary", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative(
    "calls actual CSPICE with valid empty backing storage for every method",
    () => {
      const native = getNativeAddon();
      for (const spec of calls) {
        const args = [...spec.args];
        for (const position of spec.vectors) args[position] = [];
        const expected =
          spec.output === "vector"
            ? []
            : spec.output === "unit"
              ? { unit: [], norm: 0 }
              : spec.output === "boolean"
                ? false
                : 0;
        expect(Reflect.apply(native[spec.name], native, args)).toEqual(
          expected,
        );
      }
    },
  );

  itNative(
    "direct addon rejects unequal dimensions and nonfinite entries before C and recovers",
    () => {
      const native = getNativeAddon();
      for (const spec of calls) {
        const args = [...spec.args];
        args[spec.vectors[0]!] = [1, 2, 3, 4, NaN];
        expect(() => Reflect.apply(native[spec.name], native, args)).toThrow();
        if (spec.vectors.length > 1) {
          args[spec.vectors[0]!] = [1, 2];
          expect(() =>
            Reflect.apply(native[spec.name], native, args),
          ).toThrow();
        }
        expect(() =>
          Reflect.apply(native[spec.name], native, spec.args),
        ).not.toThrow();
      }
    },
  );
});
