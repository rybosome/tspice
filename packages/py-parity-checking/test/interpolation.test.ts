import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { Spice } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const names = [
  "hrmesp",
  "hrmint",
  "lgresp",
  "lgrind",
  "lgrint",
  "qderiv",
] as const;
type Name = (typeof names)[number];
const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");
function caseFor(suffix: string) {
  const c = allCases.find((c) => c.caseId === "coords-vectors-" + suffix);
  if (!c) throw new Error("Missing interpolation case " + suffix);
  return c;
}
function fields(value: unknown): number[] {
  if (typeof value === "number") return [value];
  if (Array.isArray(value)) {
    if (!value.every((item) => typeof item === "number"))
      throw new Error("Missing derivative component");
    return [...value];
  }
  if (typeof value === "object" && value !== null) {
    if (
      "f" in value &&
      typeof value.f === "number" &&
      "df" in value &&
      typeof value.df === "number"
    )
      return [value.f, value.df];
    if (
      "p" in value &&
      typeof value.p === "number" &&
      "dp" in value &&
      typeof value.dp === "number"
    )
      return [value.p, value.dp];
  }
  throw new Error("Unrecognized interpolation result");
}
function close(a: readonly number[], b: readonly number[]) {
  expect(a).toHaveLength(b.length);
  b.forEach((v, i) => expect(a[i]).toBeCloseTo(v, 12));
}
const vectors = [3.25, -4, 5.5, -6.5];
const boundary: {
  name: Name;
  args: unknown[];
  arrays: number[];
  scalars: number[];
}[] = [
  {
    name: "hrmesp",
    args: [10, 2, [2, -1.5, -3, -7], 11],
    arrays: [2],
    scalars: [0, 1, 3],
  },
  {
    name: "hrmint",
    args: [[10, 12], [2, -1.5, -3, -7], 11],
    arrays: [0, 1],
    scalars: [2],
  },
  {
    name: "lgresp",
    args: [-1, 1, [17, 2, -3, -40], 0.5],
    arrays: [2],
    scalars: [0, 1, 3],
  },
  {
    name: "lgrind",
    args: [[-1, 0, 1, 2], [17, 2, -3, -40], 0.5],
    arrays: [0, 1],
    scalars: [2],
  },
  {
    name: "lgrint",
    args: [[-1, 0, 1, 2], [17, 2, -3, -40], 0.5],
    arrays: [0, 1],
    scalars: [2],
  },
  {
    name: "qderiv",
    args: [[-2, 3, -5, 7], [11, -13, 17, -19], 2],
    arrays: [0, 1],
    scalars: [2],
  },
];
function invoke(raw: Spice["raw"], name: Name, args: unknown[]) {
  return Reflect.apply(raw[name], raw, args);
}
function unread(length: number) {
  return new Proxy<number[]>([], {
    get(target, key, receiver) {
      if (key === "length") return length;
      if (typeof key === "string" && /^\d+$/.test(key))
        throw new Error("Unexpected oversized entry read");
      return Reflect.get(target, key, receiver);
    },
  });
}
describe("raw Hermite and Lagrange interpolation and endpoint derivatives", () => {
  for (const backend of ["wasm", "node"] as const) {
    const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    run(
      `${backend}: observes every small ordinate and slope in its original units`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const name of names)
            for (const label of [
              "scaled-ordinates",
              "scaled-abscissas",
            ] as const) {
              const c = caseFor(name + "-" + label),
                oracle = await runCaseInSidecar(c, fixturesRoot),
                actual = runCaseInTspice(spice, c, fixturesRoot);
              if (!oracle.ok) throw new Error(oracle.error.message);
              if (!actual.ok) throw new Error(actual.error.message);
              expect(actual.outputs).toHaveLength(2);
              expect(oracle.outputs).toHaveLength(2);
              for (let i = 0; i < 2; i++) {
                const result = actual.outputs[i],
                  ref = oracle.outputs[i];
                if (!result || !ref || result.op !== ref.op)
                  throw new Error("Missing live interpolation output");
                const r = i === 0 ? 1e100 : 1e-100;
                const normalize = (value: unknown) =>
                  fields(value).map((v, component) =>
                    label === "scaled-ordinates"
                      ? v / r
                      : component === 1 || name === "qderiv"
                        ? v * r
                        : v,
                  );
                const expected =
                  name === "qderiv"
                    ? vectors
                    : name === "hrmesp" ||
                        name === "hrmint" ||
                        name === "lgrind"
                      ? [0.875, -3.25]
                      : [0.875];
                close(normalize(result.value), normalize(ref.value));
                close(normalize(ref.value), expected);
              }
            }
          const c = caseFor("qderiv-balanced-extreme-endpoints"),
            oracle = await runCaseInSidecar(c, fixturesRoot),
            actual = runCaseInTspice(spice, c, fixturesRoot);
          if (!oracle.ok) throw new Error(oracle.error.message);
          if (!actual.ok) throw new Error(actual.error.message);
          const normalize = (v: unknown) =>
            fields(v).map((x, i) => (i === 2 ? x * Number.MAX_VALUE : x));
          const reference = normalize(oracle.outputs[0]?.value);
          close(normalize(actual.outputs[0]?.value), reference);
          close(reference, [1, -1, -1]);
        } finally {
          await dispose();
        }
      },
      45_000,
    );
    run(
      `${backend}: preserves interleaved slopes, physical derivative units and endpoint orientation`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          const raw = spice.raw;
          for (const result of [
            raw.hrmesp(10, 2, [2, -1.5, -3, -7], 11),
            raw.hrmesp(12, -2, [-3, -7, 2, -1.5], 11),
            raw.hrmint([12, 10], [-3, -7, 2, -1.5], 11),
          ])
            close([result.f, result.df], [0.875, -1.625]);
          close(
            fields(
              raw.hrmint([2, -1, 0.5], [-40, -67, 17, -34, 0.875, -3.25], 0.25),
            ),
            [1.453125, -1.8125],
          );
          close(
            fields(raw.lgrind([-1, 0, 0.5, 2], [17, 2, 0.875, -40], 0.25)),
            [1.453125, -1.8125],
          );
          expect(raw.lgresp(16, -2, [-151, -40, -3, 2], 11)).toBeCloseTo(
            0.875,
            12,
          );
          expect(
            raw.lgrint([-1, 0, 0.5, 2], [17, 2, 0.875, -40], 0.25),
          ).toBeCloseTo(1.453125, 12);
          expect(raw.hrmesp(10, 2, [7, -3], 12)).toEqual({ f: 1, df: -3 });
          expect(raw.lgrind([10], [7], 12)).toEqual({ p: 7, dp: 0 });
          const a = Object.freeze([-2, 3, -5, 7]),
            b = Object.freeze([11, -13, 17, -19]);
          expect(raw.qderiv(a, b, 2)).toEqual(vectors);
          expect(raw.qderiv(b, a, -2)).toEqual(vectors);
          expect(raw.qderiv([1], [9], 1)).toEqual([4]);
        } finally {
          await dispose();
        }
      },
    );
    run(
      `${backend}: reports actual table, step, repeated-node and endpoint-spacing errors then recovers`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          const errors = [
            ...names.slice(0, 5).map((n) => n + "-empty-table-error"),
            "hrmesp-zero-step-error",
            "lgresp-zero-step-error",
            ...["hrmint", "lgrind", "lgrint"].map(
              (n) => n + "-duplicate-node-error",
            ),
            "qderiv-zero-delta-error",
          ];
          for (const suffix of errors) {
            const c = caseFor(suffix),
              oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (oracle.ok || actual.ok || c.expectation.kind !== "error")
              throw new Error("Missing actual interpolation error: " + suffix);
            for (const fragment of c.expectation.errorMessageIncludes ?? []) {
              expect(oracle.error.message).toContain(fragment);
              expect(actual.error.message).toContain(fragment);
            }
            expect(spice.raw.failed()).toBe(false);
            expect(spice.raw.hrmint([10], [7, -3], 12)).toEqual({
              f: 1,
              df: -3,
            });
            expect(spice.raw.qderiv([1], [9], 1)).toEqual([4]);
          }
        } finally {
          try {
            spice.raw.reset();
            spice.raw.kclear();
          } finally {
            await dispose();
          }
        }
      },
      40_000,
    );
    run(
      `${backend}: rejects malformed and unsupported inputs before calling CSPICE`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          for (const c of boundary) {
            for (const slot of c.scalars)
              for (const invalid of [NaN, Infinity, -Infinity, "1", null]) {
                const args = [...c.args];
                args[slot] = invalid;
                expect(() => invoke(raw, c.name, args)).toThrow();
              }
            for (const slot of c.arrays) {
              for (const invalid of [null, "", {}, new Float64Array(2)]) {
                const args = [...c.args];
                args[slot] = invalid;
                expect(() => invoke(raw, c.name, args)).toThrow();
              }
              const source = c.args[slot];
              if (!Array.isArray(source))
                throw new Error("Invalid boundary fixture");
              for (let i = 0; i < source.length; i++)
                for (const invalid of [
                  NaN,
                  Infinity,
                  -Infinity,
                  null,
                  undefined,
                  "1",
                ]) {
                  const args = [...c.args],
                    array = [...source];
                  array[i] = invalid;
                  args[slot] = array;
                  expect(() => invoke(raw, c.name, args)).toThrow();
                }
            }
          }
          expect(() => raw.hrmesp(0, 1, [2], 0)).toThrow(RangeError);
          expect(() => raw.hrmint([0, 1], [2, -3], 0)).toThrow(RangeError);
          for (const fn of ["lgrind", "lgrint", "qderiv"] as const)
            expect(() => raw[fn]([0, 1], [2], 1)).toThrow(RangeError);
          expect(() => raw.qderiv([], [], 1)).toThrow(RangeError);
          // Synthetic lengths exercise signed C arithmetic without allocating huge arrays.
          expect(() => raw.hrmesp(0, 1, unread(2 * 67108864), 0)).toThrow(
            RangeError,
          );
          expect(() =>
            raw.hrmint(unread(357913942), unread(2 * 357913942), 0),
          ).toThrow(RangeError);
          expect(() => raw.lgresp(0, 1, unread(268435456), 0)).toThrow(
            RangeError,
          );
          expect(() =>
            raw.lgrind(unread(715827883), unread(715827883), 0),
          ).toThrow(RangeError);
          expect(() =>
            raw.lgrint(unread(268435456), unread(268435456), 0),
          ).toThrow(RangeError);
          expect(() =>
            raw.qderiv(unread(2147483647), unread(2147483647), 1),
          ).toThrow(RangeError);
          expect(raw.failed()).toBe(false);
          expect(raw.qderiv([1], [9], 1)).toEqual([4]);
        } finally {
          await dispose();
        }
      },
    );
    run(
      `${backend}: retains owned outputs across input mutation and repeated calls`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const a = [-2, 3, -5, 7],
            b = [11, -13, 17, -19],
            y = [2, -1.5, -3, -7],
            xs = [10, 12];
          const output = raw.qderiv(a, b, 2),
            hermite = raw.hrmint(xs, y, 11),
            even = raw.hrmesp(10, 2, y, 11),
            lagrange = raw.lgrind(xs, [2, 4], 11);
          expect(output).not.toBe(a);
          expect(output).not.toBe(b);
          a.fill(4);
          b.fill(-4);
          y.fill(0);
          xs[0] = 9;
          for (let i = 0; i < 16; i++) {
            raw.qderiv(b, a, 1);
            raw.hrmint(xs, y, 10);
            raw.hrmesp(0, 1, y, 0.5);
            raw.lgrind(xs, [4, 5], 11);
          }
          expect(output).toEqual(vectors);
          expect(hermite).toEqual({ f: 0.875, df: -1.625 });
          expect(even).toEqual(hermite);
          expect(lagrange).toEqual({ p: 3, dp: 1 });
          output.fill(99);
          expect(a).toEqual([4, 4, 4, 4]);
          expect(raw.qderiv(b, a, 1)).toEqual([4, 4, 4, 4]);
        } finally {
          await dispose();
        }
      },
    );
  }
});
