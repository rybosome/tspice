import { describe, expect, it, vi } from "vitest";
import { brandMat3RowMajor } from "@rybosome/tspice-core";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import type { NativeAddon } from "../src/runtime/addon.js";

type Method =
  "vlcom" | "vlcom3" | "vperp" | "vproj" | "vrel" | "vrotv" | "rotvec" | "vtmv";
const first = Object.freeze([1, -2, 3] as const);
const second = Object.freeze([4, 5, -6] as const);
const third = Object.freeze([-7, 8, 9] as const);
const matrix = brandMat3RowMajor([1, 2, 3, 4, 5, 6, 7, 8, 11]);

const calls: readonly {
  name: Method;
  args: readonly unknown[];
  vectors: readonly number[];
  scalars?: readonly number[];
}[] = [
  {
    name: "vlcom",
    args: [2.5, first, -3.25, second],
    vectors: [1, 3],
    scalars: [0, 2],
  },
  {
    name: "vlcom3",
    args: [2.5, first, -3.25, second, 4.75, third],
    vectors: [1, 3, 5],
    scalars: [0, 2, 4],
  },
  { name: "vperp", args: [first, second], vectors: [0, 1] },
  { name: "vproj", args: [first, second], vectors: [0, 1] },
  { name: "vrel", args: [first, second], vectors: [0, 1] },
  {
    name: "vrotv",
    args: [first, second, 0.375],
    vectors: [0, 1],
    scalars: [2],
  },
  { name: "rotvec", args: [first, 0.375, -4], vectors: [0], scalars: [1] },
  { name: "vtmv", args: [first, matrix, second], vectors: [0, 2] },
];

function apiFor(native: Partial<NativeAddon>) {
  // Each test invokes only its configured method. The contained partial-addon
  // assertion permits deliberately malformed mock results at this boundary.
  return createCoordsVectorsApi(native as NativeAddon);
}

function scalarResult(name: Method): boolean {
  return name === "vrel" || name === "vtmv";
}

function expectedOutput(name: Method): number | number[] {
  return scalarResult(name) ? 17.25 : [11, -23, 37];
}

describe("native vector-combination boundary", () => {
  for (const spec of calls) {
    it(`${spec.name} validates every vector argument before native execution and preserves readonly argument order`, () => {
      const call = vi.fn().mockReturnValue(expectedOutput(spec.name));
      const api = apiFor({ [spec.name]: call });
      const malformed: unknown[] = [
        null,
        {},
        [],
        [1, 2],
        [1, 2, 3, 4],
        Object.assign(new Array<number>(3), { 0: 1, 2: 3 }),
        new Float64Array([1, 2, 3]),
      ];
      for (let index = 0; index < 3; index++) {
        for (const bad of [NaN, Infinity, -Infinity, "2", undefined]) {
          const vector: unknown[] = [1, 2, 3];
          vector[index] = bad;
          malformed.push(vector);
        }
      }
      for (const position of spec.vectors) {
        for (const invalid of malformed) {
          const args = [...spec.args];
          args[position] = invalid;
          expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
            TypeError,
          );
        }
      }
      expect(call).not.toHaveBeenCalled();
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        expectedOutput(spec.name),
      );
      expect(call).toHaveBeenCalledOnce();
      expect(call).toHaveBeenCalledWith(...spec.args);
      expect(first).toEqual([1, -2, 3]);
      expect(second).toEqual([4, 5, -6]);
      expect(third).toEqual([-7, 8, 9]);
    });

    if (spec.scalars) {
      it(`${spec.name} rejects nonfinite and nonnumeric scalar arguments before native execution`, () => {
        const call = vi.fn().mockReturnValue(expectedOutput(spec.name));
        const api = apiFor({ [spec.name]: call });
        for (const position of spec.scalars ?? []) {
          for (const invalid of [
            NaN,
            Infinity,
            -Infinity,
            "1",
            null,
            undefined,
          ]) {
            const args = [...spec.args];
            args[position] = invalid;
            expect(() =>
              Reflect.apply(api[spec.name], undefined, args),
            ).toThrow(TypeError);
          }
        }
        expect(call).not.toHaveBeenCalled();
        Reflect.apply(api[spec.name], undefined, spec.args);
        expect(call).toHaveBeenCalledWith(...spec.args);
      });
    }

    it(`${spec.name} rejects malformed native results and permits recovery`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      const malformed: unknown[] = scalarResult(spec.name)
        ? ["1", null, undefined, [], {}]
        : [
            null,
            {},
            [1, 2],
            [1, 2, 3, 4],
            [1, "2", 3],
            Object.assign(new Array<number>(3), { 0: 1, 2: 3 }),
          ];
      for (const result of malformed) {
        call.mockReturnValueOnce(result);
        expect(() =>
          Reflect.apply(api[spec.name], undefined, spec.args),
        ).toThrow(TypeError);
      }
      call.mockReturnValueOnce(expectedOutput(spec.name));
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        expectedOutput(spec.name),
      );
    });

    it(`${spec.name} preserves native nonfinite values and failures`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      for (const component of [Infinity, -Infinity, NaN, -0]) {
        const expected = scalarResult(spec.name)
          ? component
          : [component, -23, 37];
        call.mockReturnValueOnce(expected);
        expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
          expected,
        );
      }
      const failure = new Error("native combination failure");
      call.mockImplementationOnce(() => {
        throw failure;
      });
      expect(() => Reflect.apply(api[spec.name], undefined, spec.args)).toThrow(
        failure,
      );
    });

    if (!scalarResult(spec.name)) {
      it(`${spec.name} returns an independent vector copy`, () => {
        const ownedByNative = [11, -23, 37];
        const api = apiFor({ [spec.name]: () => ownedByNative });
        const result = Reflect.apply(api[spec.name], undefined, spec.args);
        ownedByNative[0] = 999;
        expect(result).toEqual([11, -23, 37]);
      });
    }
  }

  it("rotvec rejects invalid signed-32 axes and forwards accepted axes unchanged for CSPICE reduction", () => {
    const call = vi.fn().mockReturnValue([11, -23, 37]);
    const api = apiFor({ rotvec: call });
    for (const axis of [1.25, NaN, Infinity, -Infinity, "3", null, undefined]) {
      expect(() =>
        Reflect.apply(api.rotvec, undefined, [first, 0.5, axis]),
      ).toThrow(TypeError);
    }
    for (const axis of [-2147483649, 2147483648]) {
      expect(() => api.rotvec(first, 0.5, axis)).toThrow(RangeError);
    }
    expect(call).not.toHaveBeenCalled();
    for (const axis of [-2147483648, -4, -1, 0, 1, 2, 3, 4, 2147483647]) {
      api.rotvec(first, 0.5, axis);
      expect(call).toHaveBeenLastCalledWith(first, 0.5, axis);
    }
  });

  it("vtmv validates all row-major matrix entries and copies array-like matrix storage for native use", () => {
    const call = vi.fn().mockReturnValue(123);
    const api = apiFor({ vtmv: call });
    const malformed: unknown[] = [
      null,
      {},
      new DataView(new ArrayBuffer(72)),
      [],
      new Array(8).fill(0),
      new Array(10).fill(0),
    ];
    for (let index = 0; index < 9; index++) {
      for (const invalid of [NaN, Infinity, -Infinity, "2", undefined]) {
        const input: unknown[] = [...matrix];
        input[index] = invalid;
        malformed.push(input);
      }
    }
    for (const invalid of malformed) {
      expect(() =>
        Reflect.apply(api.vtmv, undefined, [first, invalid, second]),
      ).toThrow();
    }
    expect(call).not.toHaveBeenCalled();
    const matrixArray = new Float64Array(matrix);
    expect(
      Reflect.apply(api.vtmv, undefined, [first, matrixArray, second]),
    ).toBe(123);
    expect(call).toHaveBeenCalledWith(first, [...matrix], second);
    matrixArray[0] = 999;
    expect(call.mock.calls[0]?.[1]).toEqual([...matrix]);
    expect(api.vtmv(first, matrix, second)).toBe(123);
  });
});

// Shape stays fixed and every value is finite. A second read throws in JS,
// so even a regression cannot pass an invalid buffer length to C.
function readOnceInput(values: readonly number[]) {
  const entries = values.map(() => 0);
  let lengths = 0;
  const input = new Proxy([...values], {
    get(target, key, receiver) {
      if (key === "length") {
        if (++lengths > 1) throw new Error("Input length reread");
        return values.length;
      }
      if (key === Symbol.iterator)
        throw new Error("Unexpected caller iterator");
      if (typeof key === "string" && /^\d+$/.test(key)) {
        const index = Number(key);
        if (index >= values.length || entries[index] !== 0)
          throw new Error("Input component reread");
        entries[index] = 1;
      }
      return Reflect.get(target, key, receiver);
    },
  });
  return {
    input,
    check() {
      expect(lengths).toBe(1);
      expect(entries).toEqual(values.map(() => 1));
    },
  };
}

it("delegates owned snapshots after reading each fixed input length and component once", () => {
  for (const spec of calls) {
    const call = vi.fn().mockReturnValue(expectedOutput(spec.name)),
      api = apiFor({ [spec.name]: call });
    const tracked = spec.args.map((arg) =>
      Array.isArray(arg) ? readOnceInput(arg) : undefined,
    );
    const args = spec.args.map((arg, i) => tracked[i]?.input ?? arg);
    Reflect.apply(api[spec.name], api, args);
    expect(call).toHaveBeenCalledOnce();
    for (let i = 0; i < args.length; i++) {
      const item = tracked[i],
        received: unknown = call.mock.calls[0]?.[i];
      if (item) {
        expect(Object.is(received, item.input)).toBe(false);
        item.check();
      }
      expect(received).toEqual(spec.args[i]);
    }
  }
});
