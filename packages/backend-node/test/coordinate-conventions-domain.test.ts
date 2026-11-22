import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import type { NativeAddon } from "../src/runtime/addon.js";

type Method =
  "azlrec" | "recazl" | "pgrrec" | "recpgr" | "radrec" | "recrad" | "srfrec";
const rect = Object.freeze([1, -2, 3] as const);
const calls: readonly {
  name: Method;
  args: readonly unknown[];
  scalar: readonly number[];
  vector?: number;
  flags?: readonly number[];
  fields?: readonly string[];
}[] = [
  {
    name: "azlrec",
    args: [-7, 8, -9, true, false],
    scalar: [0, 1, 2],
    flags: [3, 4],
  },
  {
    name: "recazl",
    args: [rect, false, true],
    scalar: [],
    vector: 0,
    flags: [1, 2],
    fields: ["range", "az", "el"],
  },
  {
    name: "pgrrec",
    args: [" eArTh ", -2, 3, -4, 5, -0.1],
    scalar: [1, 2, 3, 4, 5],
  },
  {
    name: "recpgr",
    args: ["399", rect, 5, -0.2],
    scalar: [2, 3],
    vector: 1,
    fields: ["lon", "lat", "alt"],
  },
  { name: "radrec", args: [-7, 8, -9], scalar: [0, 1, 2] },
  {
    name: "recrad",
    args: [rect],
    scalar: [],
    vector: 0,
    fields: ["range", "ra", "dec"],
  },
  { name: "srfrec", args: [-2147483648, -2, 3], scalar: [1, 2] },
];

function apiFor(native: Partial<NativeAddon>) {
  // Only the configured method is invoked. This contained partial-addon
  // assertion permits deliberate malformed native results at the boundary.
  return createCoordsVectorsApi(native as NativeAddon);
}

function resultFor(
  fields: readonly string[] | undefined,
  values = [17, -23, 31],
): unknown {
  return fields
    ? Object.fromEntries(fields.map((field, i) => [field, values[i]]))
    : [...values];
}

describe("native coordinate-convention boundary", () => {
  for (const spec of calls) {
    it(`${spec.name} preserves argument order, readonly inputs and every returned component`, () => {
      const call = vi.fn().mockReturnValue(resultFor(spec.fields));
      const api = apiFor({ [spec.name]: call });
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        resultFor(spec.fields),
      );
      expect(call).toHaveBeenCalledOnce();
      expect(call).toHaveBeenCalledWith(...spec.args);
      expect(rect).toEqual([1, -2, 3]);
    });

    if (spec.scalar.length) {
      it(`${spec.name} rejects every nonfinite or nonnumeric scalar before native execution`, () => {
        const call = vi.fn().mockReturnValue(resultFor(spec.fields));
        const api = apiFor({ [spec.name]: call });
        for (const position of spec.scalar) {
          for (const value of [
            NaN,
            Infinity,
            -Infinity,
            "1",
            null,
            undefined,
            1n,
          ]) {
            const args = [...spec.args];
            args[position] = value;
            expect(() =>
              Reflect.apply(api[spec.name], undefined, args),
            ).toThrow(TypeError);
          }
        }
        expect(call).not.toHaveBeenCalled();
      });
    }

    if (spec.vector !== undefined) {
      it(`${spec.name} validates all three finite input components and exact length`, () => {
        const call = vi.fn().mockReturnValue(resultFor(spec.fields));
        const api = apiFor({ [spec.name]: call });
        const invalid: unknown[] = [
          null,
          {},
          [],
          [1, 2],
          [1, 2, 3, 4],
          new Float64Array([1, 2, 3]),
          Object.assign(new Array<number>(3), { 0: 1, 2: 3 }),
        ];
        for (let i = 0; i < 3; i++) {
          for (const value of [NaN, Infinity, -Infinity, "1", undefined, 1n]) {
            const input: unknown[] = [...rect];
            input[i] = value;
            invalid.push(input);
          }
        }
        for (const value of invalid) {
          const args = [...spec.args];
          args[spec.vector!] = value;
          expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
            TypeError,
          );
        }
        expect(call).not.toHaveBeenCalled();
      });
    }

    if (spec.flags) {
      it(`${spec.name} requires actual booleans and forwards all four flag combinations`, () => {
        const call = vi.fn().mockReturnValue(resultFor(spec.fields));
        const api = apiFor({ [spec.name]: call });
        for (const position of spec.flags!) {
          for (const value of [0, 1, "true", null, undefined, {}, NaN]) {
            const args = [...spec.args];
            args[position] = value;
            expect(() =>
              Reflect.apply(api[spec.name], undefined, args),
            ).toThrow(TypeError);
          }
        }
        expect(call).not.toHaveBeenCalled();
        for (const azccw of [true, false])
          for (const elplsz of [true, false]) {
            const args = [...spec.args];
            args[spec.flags![0]!] = azccw;
            args[spec.flags![1]!] = elplsz;
            Reflect.apply(api[spec.name], undefined, args);
            expect(call).toHaveBeenLastCalledWith(...args);
          }
      });
    }

    it(`${spec.name} rejects malformed output and recovers`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      const invalid: unknown[] = [null, undefined, {}, [], "1", 1];
      if (spec.fields) {
        for (const field of spec.fields) {
          for (const value of [undefined, "1", 1n]) {
            invalid.push({
              ...Object.fromEntries(spec.fields.map((f) => [f, 1])),
              [field]: value,
            });
          }
        }
      } else
        invalid.push(
          [1, 2],
          [1, 2, 3, 4],
          [1, "2", 3],
          new Float64Array([1, 2, 3]),
          Object.assign(new Array<number>(3), { 0: 1, 2: 3 }),
        );
      for (const result of invalid) {
        call.mockReturnValueOnce(result);
        expect(() =>
          Reflect.apply(api[spec.name], undefined, spec.args),
        ).toThrow();
      }
      call.mockReturnValueOnce(resultFor(spec.fields));
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        resultFor(spec.fields),
      );
    });

    it(`${spec.name} copies native output and preserves nonfinite numbers and signed zero`, () => {
      const values = [NaN, Infinity, -Infinity];
      const native = spec.fields
        ? Object.fromEntries(spec.fields.map((field, i) => [field, values[i]]))
        : [...values];
      const call = vi.fn().mockReturnValue(native);
      const api = apiFor({ [spec.name]: call });
      const result = Reflect.apply(api[spec.name], undefined, spec.args);
      if (Array.isArray(native)) native.fill(99);
      else for (const field of spec.fields!) native[field] = 99;
      expect(result).toEqual(resultFor(spec.fields, values));
      call.mockReturnValueOnce(resultFor(spec.fields, [-0, -0, -0]));
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toEqual(
        resultFor(spec.fields, [-0, -0, -0]),
      );
    });

    it(`${spec.name} propagates the original native failure`, () => {
      const failure = new Error("SPICE(coordinate conversion failure)");
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

  for (const name of ["pgrrec", "recpgr"] as const) {
    it(`${name} rejects nonstring/NUL bodies but forwards empty, whitespace, numeric and Unicode names unchanged`, () => {
      const call = vi
        .fn()
        .mockReturnValue(
          name === "pgrrec" ? [1, 2, 3] : { lon: 1, lat: 2, alt: 3 },
        );
      const api = apiFor({ [name]: call });
      const invoke = (body: unknown) =>
        Reflect.apply(
          api[name],
          undefined,
          name === "pgrrec" ? [body, 1, 2, 3, 4, -0.1] : [body, rect, 4, -0.1],
        );
      for (const body of [
        399,
        null,
        undefined,
        {},
        ["Earth"],
        "EARTH\0MARS",
        "\0",
      ])
        expect(() => invoke(body)).toThrow(TypeError);
      expect(call).not.toHaveBeenCalled();
      for (const body of ["", " ", " eArTh ", "-2147483648", "天体"]) {
        invoke(body);
        expect(call.mock.lastCall?.[0]).toBe(body);
      }
    });
  }

  it("srfrec validates signed32 body IDs without clamping and forwards valid endpoints", () => {
    const call = vi.fn().mockReturnValue([1, 2, 3]);
    const api = apiFor({ srfrec: call });
    for (const body of [
      NaN,
      Infinity,
      -Infinity,
      1.5,
      "399",
      null,
      undefined,
      -2147483649,
      2147483648,
    ])
      expect(() =>
        Reflect.apply(api.srfrec, undefined, [body, 0, 0]),
      ).toThrow();
    expect(call).not.toHaveBeenCalled();
    for (const body of [-2147483648, 2147483647, -0]) {
      api.srfrec(body, 0, 0);
      expect(call).toHaveBeenLastCalledWith(body, 0, 0);
    }
  });

  it("passes finite invalid spheroid parameters to CSPICE instead of silently correcting them", () => {
    const pgrrec = vi.fn().mockReturnValue([1, 2, 3]);
    const recpgr = vi.fn().mockReturnValue({ lon: 1, lat: 2, alt: 3 });
    const api = apiFor({ pgrrec, recpgr });
    for (const [re, f] of [
      [0, 1],
      [-1, 2],
      [2, -0.5],
    ]) {
      api.pgrrec("EARTH", 0, 0, 0, re!, f!);
      api.recpgr("EARTH", rect, re!, f!);
      expect(pgrrec).toHaveBeenLastCalledWith("EARTH", 0, 0, 0, re, f);
      expect(recpgr).toHaveBeenLastCalledWith("EARTH", rect, re, f);
    }
  });
});
