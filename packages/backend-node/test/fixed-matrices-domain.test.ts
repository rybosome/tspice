import { describe, expect, it, vi } from "vitest";
import {
  brandMat3RowMajor,
  isBrandedMat3RowMajor,
} from "@rybosome/tspice-core";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import type { NativeAddon } from "../src/runtime/addon.js";

type Method =
  | "det"
  | "diags2"
  | "ident"
  | "invert"
  | "invort"
  | "isrot"
  | "mequ"
  | "mtxm"
  | "mxmt"
  | "trace"
  | "xpose";
const first = brandMat3RowMajor([1, 2, 3, 4, 5, 6, 7, 8, 11]);
const second = brandMat3RowMajor([2, -3, 5, 7, 11, -13, 17, 19, 23]);
const symmat = Object.freeze([27, 5, -91, 3] as const);
const calls: readonly {
  name: Method;
  args: readonly unknown[];
  matrices: readonly number[];
}[] = [
  { name: "det", args: [first], matrices: [0] },
  { name: "diags2", args: [symmat], matrices: [] },
  { name: "ident", args: [], matrices: [] },
  { name: "invert", args: [first], matrices: [0] },
  { name: "invort", args: [first], matrices: [0] },
  { name: "isrot", args: [first, 0.001, 0.002], matrices: [0] },
  { name: "mequ", args: [first], matrices: [0] },
  { name: "mtxm", args: [first, second], matrices: [0, 1] },
  { name: "mxmt", args: [first, second], matrices: [0, 1] },
  { name: "trace", args: [first], matrices: [0] },
  { name: "xpose", args: [first], matrices: [0] },
];

function apiFor(native: Partial<NativeAddon>) {
  // Each test invokes only its configured mock. This contained partial-addon
  // assertion permits deliberate malformed native results at the boundary.
  return createCoordsVectorsApi(native as NativeAddon);
}

function matrixOutput(name: Method): boolean {
  return (
    name !== "det" && name !== "trace" && name !== "diags2" && name !== "isrot"
  );
}

function outputFor(name: Method): unknown {
  if (name === "det" || name === "trace") return 17.25;
  if (name === "isrot") return true;
  if (name === "diags2")
    return { diag: [17, 0, 0, -3], rotate: [0.8, -0.6, 0.6, 0.8] };
  return [11, 12, 13, -21, -22, -23, 31, 32, 33];
}

describe("native fixed-matrix boundary", () => {
  for (const spec of calls) {
    it(`${spec.name} preserves argument order and every returned component`, () => {
      const call = vi.fn().mockReturnValue(outputFor(spec.name));
      const api = apiFor({ [spec.name]: call });
      const result = Reflect.apply(api[spec.name], undefined, spec.args);
      expect(result).toEqual(outputFor(spec.name));
      expect(call).toHaveBeenCalledOnce();
      expect(call).toHaveBeenCalledWith(...spec.args);
      if (matrixOutput(spec.name))
        expect(isBrandedMat3RowMajor(result)).toBe(true);
    });

    if (spec.matrices.length) {
      it(`${spec.name} rejects malformed matrices before native execution and preserves typed-array row order`, () => {
        const call = vi.fn().mockReturnValue(outputFor(spec.name));
        const api = apiFor({ [spec.name]: call });
        const malformed: unknown[] = [
          null,
          {},
          [],
          new Array(8).fill(0),
          new Array(10).fill(0),
          new DataView(new ArrayBuffer(72)),
          new BigInt64Array(9),
          Object.assign(new Array<number>(9), { 0: 1, 8: 9 }),
        ];
        for (let i = 0; i < 9; i++) {
          for (const invalid of [NaN, Infinity, -Infinity, "1", undefined]) {
            const input: unknown[] = [...first];
            input[i] = invalid;
            malformed.push(input);
          }
        }
        for (const position of spec.matrices) {
          for (const value of malformed) {
            const args = [...spec.args];
            args[position] = value;
            expect(() =>
              Reflect.apply(api[spec.name], undefined, args),
            ).toThrow();
          }
        }
        expect(call).not.toHaveBeenCalled();
        const args = [...spec.args];
        const typed = new Float64Array(first);
        args[spec.matrices[0]!] = typed;
        Reflect.apply(api[spec.name], undefined, args);
        expect(call.mock.calls[0]?.[spec.matrices[0]!]).toEqual([...first]);
        typed.fill(99);
        expect(call.mock.calls[0]?.[spec.matrices[0]!]).toEqual([...first]);
      });
    }

    it(`${spec.name} rejects malformed native results and recovers`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      const malformed: unknown[] = matrixOutput(spec.name)
        ? [
            null,
            {},
            [],
            new Array(8).fill(1),
            new Array(10).fill(1),
            [1, 2, 3, 4, "5", 6, 7, 8, 9],
            Object.assign(new Array<number>(9), { 0: 1, 8: 9 }),
          ]
        : spec.name === "isrot"
          ? [0, 1, "true", null, undefined]
          : spec.name === "diags2"
            ? [
                null,
                [],
                {},
                { diag: [1, 0, 0, 2] },
                { diag: [1, 0, 2], rotate: [1, 0, 0, 1] },
                { diag: [1, 0, 0, 2], rotate: [1, "0", 0, 1] },
              ]
            : ["1", null, undefined, [], {}];
      for (const result of malformed) {
        call.mockReturnValueOnce(result);
        expect(() =>
          Reflect.apply(api[spec.name], undefined, spec.args),
        ).toThrow(TypeError);
      }
      call.mockReturnValueOnce(outputFor(spec.name));
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        outputFor(spec.name),
      );
    });

    it(`${spec.name} propagates the original native failure`, () => {
      const failure = new Error("SPICE(fixed matrix failure)");
      const api = apiFor({
        [spec.name]: () => {
          throw failure;
        },
      });
      expect(() => Reflect.apply(api[spec.name], undefined, spec.args)).toThrow(
        failure,
      );
    });

    if (matrixOutput(spec.name)) {
      it(`${spec.name} owns its result and preserves native NaN, infinities and signed zero`, () => {
        const native = [NaN, Infinity, -Infinity, -0, 5, 6, 7, 8, 9];
        const api = apiFor({ [spec.name]: () => native });
        const result = Reflect.apply(api[spec.name], undefined, spec.args);
        native.fill(99);
        expect(result).toEqual([NaN, Infinity, -Infinity, -0, 5, 6, 7, 8, 9]);
        expect(isBrandedMat3RowMajor(result)).toBe(true);
      });
    }
  }

  it("diags2 validates four finite entries, including its ignored lower-left entry, and forwards asymmetric input unchanged", () => {
    const call = vi.fn().mockReturnValue(outputFor("diags2"));
    const api = apiFor({ diags2: call });
    const invalidInputs: unknown[] = [
      null,
      {},
      [],
      [1, 2, 3],
      [1, 2, 3, 4, 5],
      new Float64Array([1, 2, 3, 4]),
      Object.assign(new Array<number>(4), { 0: 1, 3: 4 }),
    ];
    for (let i = 0; i < 4; i++) {
      for (const invalid of [NaN, Infinity, -Infinity, "1", undefined]) {
        const value: unknown[] = [...symmat];
        value[i] = invalid;
        invalidInputs.push(value);
      }
    }
    for (const value of invalidInputs)
      expect(() => Reflect.apply(api.diags2, undefined, [value])).toThrow(
        TypeError,
      );
    expect(call).not.toHaveBeenCalled();
    api.diags2(symmat);
    expect(call).toHaveBeenCalledWith(symmat);
    expect(symmat).toEqual([27, 5, -91, 3]);
  });

  it("diags2 independently copies both complete result matrices without finite filtering", () => {
    const native = {
      diag: [Infinity, -0, 0, NaN],
      rotate: [-0.6, -0.8, 0.8, -0.6],
    };
    const api = apiFor({ diags2: () => native });
    const result = api.diags2(symmat);
    native.diag.fill(99);
    native.rotate.fill(99);
    expect(result).toEqual({
      diag: [Infinity, -0, 0, NaN],
      rotate: [-0.6, -0.8, 0.8, -0.6],
    });
    result.diag[0] = 77;
    expect(result.rotate).toEqual([-0.6, -0.8, 0.8, -0.6]);
  });

  it("isrot rejects nonfinite tolerances but forwards finite negatives to native", () => {
    const call = vi.fn().mockReturnValue(true);
    const api = apiFor({ isrot: call });
    for (const position of [1, 2]) {
      for (const value of [NaN, Infinity, -Infinity, "0", null, undefined]) {
        const args: unknown[] = [first, 0, 0];
        args[position] = value;
        expect(() => Reflect.apply(api.isrot, undefined, args)).toThrow(
          TypeError,
        );
      }
    }
    expect(call).not.toHaveBeenCalled();
    for (const [ntol, dtol] of [
      [-1, 0],
      [0, -1],
      [0, 0],
      [-0, -0],
    ] as const) {
      expect(api.isrot(first, ntol, dtol)).toBe(true);
      expect(call).toHaveBeenLastCalledWith([...first], ntol, dtol);
    }
  });

  for (const name of ["det", "trace"] as const) {
    it(`${name} retains native scalar overflow and signed zero`, () => {
      const call = vi.fn();
      const api = apiFor({ [name]: call });
      for (const value of [Infinity, -Infinity, NaN, -0]) {
        call.mockReturnValueOnce(value);
        expect(Object.is(api[name](first), value)).toBe(true);
      }
    });
  }
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
    const call = vi.fn().mockReturnValue(outputFor(spec.name)),
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
