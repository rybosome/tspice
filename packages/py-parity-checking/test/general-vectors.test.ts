import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { Spice } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const binaryNames = [
  "vaddg",
  "vdistg",
  "vdotg",
  "vprojg",
  "vrelg",
  "vsepg",
  "vsubg",
] as const;
const unaryNames = [
  "vequg",
  "vhatg",
  "vminug",
  "vnormg",
  "vzerog",
  "unormg",
] as const;
const names = [...binaryNames, ...unaryNames, "vlcomg", "vsclg"] as const;
type GeneralName = (typeof names)[number];
const boundaryCalls: {
  name: GeneralName;
  args: unknown[];
  vectorSlots: number[];
  scalarSlots: number[];
}[] = [
  ...binaryNames.map((name) => ({
    name,
    args: [
      [1, -2, 4, -8],
      [3, 5, -7, 11],
    ],
    vectorSlots: [0, 1],
    scalarSlots: [],
  })),
  ...unaryNames.map((name) => ({
    name,
    args: [[1, -2, 4, -8]],
    vectorSlots: [0],
    scalarSlots: [],
  })),
  {
    name: "vlcomg",
    args: [2, [1, -2, 4, -8], -3, [3, 5, -7, 11]],
    vectorSlots: [1, 3],
    scalarSlots: [0, 2],
  },
  {
    name: "vsclg",
    args: [-2, [1, -2, 4, -8]],
    vectorSlots: [1],
    scalarSlots: [0],
  },
];
function invoke(
  raw: Spice["raw"],
  name: GeneralName,
  args: unknown[],
): unknown {
  return Reflect.apply(raw[name], raw, args);
}
function vectorClose(actual: readonly number[], expected: readonly number[]) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++)
    expect(actual[i]).toBeCloseTo(expected[i]!, 12);
}
// Length-only proxies ensure count rejection occurs before component reads.
// They never allocate a giant vector or invoke CSPICE at an unsafe dimension.
function dimensionOnly(length: number): number[] {
  return new Proxy<number[]>([], {
    get(target, key, receiver) {
      if (key === "length") return length;
      if (typeof key === "string" && /^\d+$/.test(key))
        throw new Error("Unexpected component read");
      return Reflect.get(target, key, receiver);
    },
  });
}
const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");
function caseFor(suffix: string) {
  const result = allCases.find((c) => c.caseId === `coords-vectors-${suffix}`);
  if (!result) throw new Error(`Missing general-vector case ${suffix}`);
  return result;
}

describe("raw general vectors", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: observes every dimension-zero output through independent actual C calls`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const name of names) {
            const c = caseFor(`${name}-dimension-zero`);
            const oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toEqual(oracle.outputs);
            expect(actual.outputs).toHaveLength(1);
            const value = actual.outputs[0]?.value;
            const expected =
              name === "vzerog"
                ? false
                : name === "unormg"
                  ? { unit: [], norm: 0 }
                  : ["vdistg", "vdotg", "vnormg", "vrelg", "vsepg"].includes(
                        name,
                      )
                    ? 0
                    : [];
            expect(value).toEqual(expected);
            expect(spice.raw.failed()).toBe(false);
          }
        } finally {
          await dispose();
        }
      },
      40_000,
    );

    testBackend(
      `${backend}: compares tiny and large outputs component by component after scaling`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const name of names.filter((name) => name !== "vzerog")) {
            const c = caseFor(`${name}-scaled-magnitudes`);
            const oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toHaveLength(2);
            expect(oracle.outputs).toHaveLength(2);
            for (let i = 0; i < 2; i++) {
              const left = actual.outputs[i],
                right = oracle.outputs[i];
              if (!left || !right || left.op !== right.op)
                throw new Error("Missing scaled general-vector observation");
              const scale =
                name === "vdotg"
                  ? i === 0
                    ? 1e-200
                    : 1e200
                  : ["vhatg", "vrelg", "vsepg"].includes(name)
                    ? 1
                    : i === 0
                      ? 1e-100
                      : 1e100;
              if (left.op === "coords-vectors.unormg" && right.op === left.op) {
                vectorClose(left.value.unit, right.value.unit);
                expect(right.value.unit).toHaveLength(4);
                expect(right.value.norm * scale).toBeCloseTo(13, 12);
                expect(left.value.norm * scale).toBeCloseTo(
                  right.value.norm * scale,
                  12,
                );
              } else if (
                Array.isArray(left.value) &&
                Array.isArray(right.value)
              ) {
                const a: unknown[] = left.value,
                  b: unknown[] = right.value;
                if (
                  !a.every((value) => typeof value === "number") ||
                  !b.every((value) => typeof value === "number")
                )
                  throw new Error("Expected numeric vector");
                vectorClose(
                  a.map((value) => value * scale),
                  b.map((value) => value * scale),
                );
                expect(b).toHaveLength(4);
                expect(b.some((value) => Math.abs(value * scale) > 0.1)).toBe(
                  true,
                );
              } else if (
                typeof left.value === "number" &&
                typeof right.value === "number"
              ) {
                expect(Math.abs(right.value * scale)).toBeGreaterThan(0.1);
                expect(left.value * scale).toBeCloseTo(right.value * scale, 12);
              } else throw new Error("Unexpected general-vector result shape");
            }
          }
          const c = caseFor("vrelg-nearby-large-components");
          const oracle = await runCaseInSidecar(c, fixturesRoot),
            actual = runCaseInTspice(spice, c, fixturesRoot);
          if (!oracle.ok) throw new Error(oracle.error.message);
          if (!actual.ok) throw new Error(actual.error.message);
          const left = actual.outputs[0],
            right = oracle.outputs[0];
          if (left?.op !== "coords-vectors.vrelg" || right?.op !== left.op)
            throw new Error("Missing small relative difference");
          expect(right.value * 1e15).toBeCloseTo(8, 12);
          expect(left.value * 1e15).toBeCloseTo(right.value * 1e15, 12);
        } finally {
          await dispose();
        }
      },
      40_000,
    );

    testBackend(
      `${backend}: retains exact extrema, ordered cancellation and raw underflow conventions`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const suffix of [
            "vequg-finite-extrema",
            "vminug-finite-extrema",
            "vprojg-subnormal-source-and-reference",
            "vzerog-last-component-subnormal",
            "vdotg-ordered-cancellation",
            "vsepg-raw-dot-underflow",
          ]) {
            const c = caseFor(suffix),
              oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toEqual(oracle.outputs);
          }
          expect(spice.raw.vprojg([Number.MIN_VALUE, 0], [1, 0])).toEqual([
            Number.MIN_VALUE,
            0,
          ]);
          expect(spice.raw.vprojg([1, 0], [Number.MIN_VALUE, 0])).toEqual([
            0, 0,
          ]);
          expect(spice.raw.vdotg([1e16, 1, -1e16, 0], [1, 1, 1, 1])).toBe(0);
          expect(spice.raw.vdotg([1e16, -1e16, 1, 0], [1, 1, 1, 1])).toBe(1);
          // Preserve the pinned raw dot-product branch, even at underflow.
          expect(spice.raw.vsepg([1e-200, 0], [1e-200, 0])).toBe(Math.PI / 2);
        } finally {
          await dispose();
        }
      },
      30_000,
    );

    testBackend(
      `${backend}: preserves coefficient order and every non-three-dimensional component`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const a = Object.freeze([1, -2, 4, -8, 16, -32, 64]),
            b = Object.freeze([-3, 5, -7, 11, -13, 17, -19]);
          expect(raw.vaddg(a, b)).toEqual([-2, 3, -3, 3, 3, -15, 45]);
          expect(raw.vsubg(a, b)).toEqual([4, -7, 11, -19, 29, -49, 83]);
          expect(raw.vlcomg(2, a, -3, b)).toEqual([
            11, -19, 29, -49, 71, -115, 185,
          ]);
          expect(raw.vsclg(-2, a)).toEqual([-2, 4, -8, 16, -32, 64, -128]);
          expect(raw.vminug(a)).toEqual([-1, 2, -4, 8, -16, 32, -64]);
          expect(raw.vnormg([3, -4, 0, 12])).toBe(13);
          expect(raw.vdistg([3, -4, 0, 12], [0, 0, 0, 0])).toBe(13);
          vectorClose(raw.vhatg([3, -4, 0, 12]), [3 / 13, -4 / 13, 0, 12 / 13]);
          const unit = raw.unormg([3, -4, 0, 12]);
          expect(unit.norm).toBe(13);
          vectorClose(unit.unit, [3 / 13, -4 / 13, 0, 12 / 13]);
          expect(raw.vprojg([1, -2, 4, -8], [2, -4, 8, -16])).toEqual([
            1, -2, 4, -8,
          ]);
          expect(raw.vzerog([0, 0, 0, 0, 0, 0, -7])).toBe(false);
          expect(raw.vzerog([0, 0, 0, 0])).toBe(true);
          expect(raw.vsepg([1, 0, 0, 0], [-2, 0, 0, 0])).toBe(Math.PI);
          expect(raw.vsepg([1, 0, 0, 0], [0, 0, 0, 3])).toBe(Math.PI / 2);
          expect(raw.vsepg([0, 0, 0, 0], [1, 2, 3, 4])).toBe(0);
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: rejects unequal dimensions, nonfinite components and unsafe counts before C`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          for (const call of boundaryCalls) {
            for (const slot of call.vectorSlots) {
              for (const invalid of [
                null,
                {},
                "1,2",
                new Float64Array([1, 2]),
              ]) {
                const args = [...call.args];
                args[slot] = invalid;
                expect(() => invoke(raw, call.name, args)).toThrow();
              }
              for (let component = 0; component < 4; component++)
                for (const invalid of [
                  NaN,
                  Infinity,
                  -Infinity,
                  "1",
                  undefined,
                ]) {
                  const values: unknown[] = [1, -2, 4, -8];
                  values[component] = invalid;
                  const args = [...call.args];
                  args[slot] = values;
                  expect(() => invoke(raw, call.name, args)).toThrow();
                }
              const args = [...call.args];
              args[slot] = dimensionOnly(
                call.name === "vprojg" || call.name === "unormg"
                  ? 2147483647
                  : 2147483648,
              );
              expect(() => invoke(raw, call.name, args)).toThrow(
                /maximum dimension/,
              );
              if (backend === "wasm") {
                args[slot] = dimensionOnly(33554433);
                expect(() => invoke(raw, call.name, args)).toThrow(
                  /buffer exceeds/,
                );
              }
            }
            for (const slot of call.scalarSlots)
              for (const invalid of [
                NaN,
                Infinity,
                -Infinity,
                "1",
                null,
                undefined,
              ]) {
                const args = [...call.args];
                args[slot] = invalid;
                expect(() => invoke(raw, call.name, args)).toThrow();
              }
            if (call.vectorSlots.length === 2)
              for (const slot of call.vectorSlots)
                for (const values of [[], [1], [1, 2, 3, 4, 5]]) {
                  const args = [...call.args];
                  args[slot] = values;
                  expect(() => invoke(raw, call.name, args)).toThrow(
                    /equal lengths/,
                  );
                }
          }
          expect(raw.vlcomg(2, [1, 2], -3, [5, 7])).toEqual([-13, -17]);
          expect(raw.failed()).toBe(false);
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: returns owned arrays across caller mutation and repeated heap reuse`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const a = [3, -4, 0, 12],
            b = [2, 7, -11, 5];
          const retained = [
            raw.vaddg(a, b),
            raw.vequg(a),
            raw.vhatg(a),
            raw.vlcomg(2, a, -3, b),
            raw.vminug(a),
            raw.vprojg(a, b),
            raw.vsclg(-2, a),
            raw.vsubg(a, b),
            raw.unormg(a).unit,
          ];
          const snapshots = retained.map((value) => [...value]);
          for (const output of retained) {
            expect(output).not.toBe(a);
            expect(output).not.toBe(b);
          }
          a.fill(99);
          b.fill(-99);
          for (let repeat = 0; repeat < 20; repeat++) {
            raw.vaddg([1, 2, 3, 4, 5, 6, 7], [7, 6, 5, 4, 3, 2, 1]);
            raw.unormg([5, 12]);
            raw.vequg([]);
          }
          expect(retained).toEqual(snapshots);
          for (const output of retained) output.fill(123);
          expect(a).toEqual([99, 99, 99, 99]);
          expect(b).toEqual([-99, -99, -99, -99]);
          expect(raw.vequg([3, -4, 0, 12])).toEqual([3, -4, 0, 12]);
          expect(raw.unormg([])).toEqual({ unit: [], norm: 0 });
        } finally {
          await dispose();
        }
      },
    );
  }
});
