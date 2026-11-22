import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { Spice } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const names = [
  "chbder",
  "chbigr",
  "chbint",
  "chbval",
  "polyds",
  "rquad",
] as const;
const chebyshev = ["chbder", "chbigr", "chbint", "chbval"] as const;
const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");
function caseFor(suffix: string) {
  const result = allCases.find((c) => c.caseId === `coords-vectors-${suffix}`);
  if (!result) throw new Error(`Missing polynomial case ${suffix}`);
  return result;
}
function numericFields(value: unknown): number[] {
  if (typeof value === "number") return [value];
  if (Array.isArray(value)) return value.flatMap(numericFields);
  if (typeof value === "object" && value !== null)
    return Object.keys(value)
      .sort()
      .flatMap((key) => numericFields(Reflect.get(value, key)));
  throw new Error("Expected only numeric polynomial result fields");
}
function vectorClose(a: readonly number[], b: readonly number[]) {
  expect(a).toHaveLength(b.length);
  for (let i = 0; i < b.length; i++) expect(a[i]).toBeCloseTo(b[i]!, 12);
}
const boundaryCalls: {
  name: (typeof names)[number];
  args: unknown[];
  arraySlot?: number;
  pairSlot?: number;
  scalarSlots: number[];
}[] = [
  {
    name: "chbder",
    args: [[2, -3, 5, -7], [10, 4], 12, 3],
    arraySlot: 0,
    pairSlot: 1,
    scalarSlots: [2],
  },
  {
    name: "chbigr",
    args: [[2, -3, 5, -7], [10, 4], 12],
    arraySlot: 0,
    pairSlot: 1,
    scalarSlots: [2],
  },
  {
    name: "chbint",
    args: [[2, -3, 5, -7], [10, 4], 12],
    arraySlot: 0,
    pairSlot: 1,
    scalarSlots: [2],
  },
  {
    name: "chbval",
    args: [[2, -3, 5, -7], [10, 4], 12],
    arraySlot: 0,
    pairSlot: 1,
    scalarSlots: [2],
  },
  {
    name: "polyds",
    args: [[2, -3, 5, -7], 3, 0.5],
    arraySlot: 0,
    scalarSlots: [2],
  },
  { name: "rquad", args: [1, 2, 5], scalarSlots: [0, 1, 2] },
];
function invoke(
  raw: Spice["raw"],
  call: (typeof boundaryCalls)[number],
  args: unknown[],
) {
  return Reflect.apply(raw[call.name], raw, args);
}
function oversized(length: number) {
  return new Proxy<number[]>([], {
    get(target, key, receiver) {
      if (key === "length") return length;
      if (typeof key === "string" && /^\d+$/.test(key))
        throw new Error("Unexpected coefficient read");
      return Reflect.get(target, key, receiver);
    },
  });
}

describe("raw polynomial expansions", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: makes every small polynomial field and tiny quadratic root observable`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const name of names) {
            const c = caseFor(`${name}-scaled-coefficients`),
              oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toHaveLength(2);
            expect(oracle.outputs).toHaveLength(2);
            for (let i = 0; i < 2; i++) {
              const left = actual.outputs[i],
                right = oracle.outputs[i];
              if (!left || !right || left.op !== right.op)
                throw new Error("Missing scaled polynomial output");
              const scale = name === "rquad" ? 1 : i === 0 ? 1e-100 : 1e100;
              const a = numericFields(left.value).map((x) => x * scale),
                b = numericFields(right.value).map((x) => x * scale);
              vectorClose(a, b);
              expect(b.some((value) => Math.abs(value) > 0.1)).toBe(true);
            }
          }
          const c = caseFor("rquad-unequal-root-magnitudes"),
            oracle = await runCaseInSidecar(c, fixturesRoot),
            actual = runCaseInTspice(spice, c, fixturesRoot);
          if (!oracle.ok) throw new Error(oracle.error.message);
          if (!actual.ok) throw new Error(actual.error.message);
          expect(actual.outputs).toHaveLength(2);
          expect(oracle.outputs).toHaveLength(2);
          for (let i = 0; i < 2; i++) {
            const left = actual.outputs[i],
              right = oracle.outputs[i];
            if (left?.op !== "coords-vectors.rquad" || right?.op !== left.op)
              throw new Error("Missing root pair");
            for (const key of ["root1", "root2"] as const) {
              const scale =
                (i === 0 && key === "root1") || (i === 1 && key === "root2")
                  ? 1e16
                  : 1e-16;
              expect(Math.abs(right.value[key][0] * scale)).toBeCloseTo(1, 12);
              expect(left.value[key][0] * scale).toBeCloseTo(
                right.value[key][0] * scale,
                12,
              );
              expect(left.value[key][1]).toBe(0);
              expect(right.value[key][1]).toBe(0);
            }
          }
        } finally {
          await dispose();
        }
      },
      30_000,
    );

    testBackend(
      `${backend}: distinguishes interval radius powers and retains every derivative and integral field`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const name of chebyshev) {
            const c = caseFor(`${name}-scaled-domain-radius`),
              oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toHaveLength(2);
            expect(oracle.outputs).toHaveLength(2);
            for (let i = 0; i < 2; i++) {
              const left = actual.outputs[i],
                right = oracle.outputs[i],
                radius = i === 0 ? 1e100 : 1e-100;
              if (!left || !right)
                throw new Error("Missing radius observation");
              if (left.op === "coords-vectors.chbder" && right.op === left.op) {
                vectorClose(
                  left.value.map((v, k) => v * Math.pow(radius, k)),
                  right.value.map((v, k) => v * Math.pow(radius, k)),
                );
                vectorClose(
                  right.value.map((v, k) => v * Math.pow(radius, k)),
                  [5, 7, -64, -168],
                );
              } else if (
                left.op === "coords-vectors.chbigr" &&
                right.op === left.op
              ) {
                vectorClose(
                  [left.value.p, left.value.itgrlp / radius],
                  [right.value.p, right.value.itgrlp / radius],
                );
                expect(right.value.itgrlp / radius).toBeCloseTo(35 / 48, 12);
              } else if (
                left.op === "coords-vectors.chbint" &&
                right.op === left.op
              ) {
                vectorClose(
                  [left.value.p, left.value.dpdx * radius],
                  [right.value.p, right.value.dpdx * radius],
                );
                expect(right.value.dpdx * radius).toBeCloseTo(7, 12);
              } else if (
                left.op === "coords-vectors.chbval" &&
                right.op === left.op
              ) {
                expect(left.value).toBeCloseTo(right.value, 12);
                expect(right.value).toBe(5);
              } else throw new Error("Unexpected interval mapping result");
            }
          }
        } finally {
          await dispose();
        }
      },
      25_000,
    );

    testBackend(
      `${backend}: preserves coefficient order, derivative tails and ordered complex roots`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const cp = Object.freeze([2, -3, 5, -7]),
            x2s = Object.freeze([10, 4] as const);
          vectorClose(
            raw.chbder(cp, x2s, 12, 6),
            [5, 1.75, -4, -2.625, 0, 0, 0],
          );
          expect(raw.chbder(cp, x2s, 12, 0)).toEqual([5]);
          expect(raw.chbint(cp, x2s, 12)).toEqual({ p: 5, dpdx: 1.75 });
          expect(raw.chbval(cp, x2s, 12)).toBe(5);
          const integral = raw.chbigr(cp, x2s, 12);
          expect(integral.p).toBe(5);
          expect(integral.itgrlp).toBeCloseTo(35 / 12, 12);
          expect(raw.chbigr(cp, x2s, 10)).toEqual({ p: -3, itgrlp: 0 });
          vectorClose(
            raw.polyds(cp, 6, 0.5),
            [0.875, -3.25, -11, -42, 0, 0, 0],
          );
          expect(raw.polyds([], 3, 2)).toEqual([0, 0, 0, 0]);
          for (const order of [-1, -2, -2147483648])
            expect(raw.polyds(cp, order, 0.5)).toEqual([]);
          for (const suffix of [
            "polyds-negative-order-no-write",
            "polyds-constant-and-empty",
          ]) {
            const c = caseFor(suffix),
              oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toEqual(oracle.outputs);
          }
          const positive = raw.rquad(1, 2, 5),
            negative = raw.rquad(-1, -2, -5);
          vectorClose(positive.root1, [-1, 2]);
          vectorClose(positive.root2, [-1, -2]);
          vectorClose(negative.root1, [-1, -2]);
          vectorClose(negative.root2, [-1, 2]);
          vectorClose(raw.rquad(1, -3, 2).root1, [2, 0]);
          vectorClose(raw.rquad(-1, 3, -2).root1, [1, 0]);
          expect(raw.rquad(0, 2, -6)).toEqual({ root1: [3, 0], root2: [3, 0] });
        } finally {
          await dispose();
        }
      },
      20_000,
    );

    testBackend(
      `${backend}: propagates genuine degree, radius and degenerate-equation errors then recovers`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const suffix of [
            "chbigr-empty-degree-error",
            "chbigr-zero-radius-error",
            "chbigr-negative-radius-error",
            "rquad-all-zero-error",
            "rquad-constant-only-error",
          ]) {
            const c = caseFor(suffix),
              oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            expect(oracle.ok).toBe(false);
            expect(actual.ok).toBe(false);
            if (oracle.ok || actual.ok || c.expectation.kind !== "error")
              throw new Error("Missing genuine polynomial error");
            for (const fragment of c.expectation.errorMessageIncludes ?? []) {
              expect(oracle.error.message).toContain(fragment);
              expect(actual.error.message).toContain(fragment);
            }
            expect(spice.raw.failed()).toBe(false);
            expect(spice.raw.chbigr([1], [0, 1], 0.5)).toEqual({
              p: 1,
              itgrlp: 0.5,
            });
            expect(spice.raw.rquad(0, 2, -6)).toEqual({
              root1: [3, 0],
              root2: [3, 0],
            });
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
      25_000,
    );

    testBackend(
      `${backend}: validates scalar, coefficient, pair and workspace boundaries before C`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          for (const call of boundaryCalls) {
            if (call.arraySlot !== undefined) {
              for (const invalid of [
                null,
                {},
                "1,2",
                new Float64Array([1, 2]),
              ]) {
                const args = [...call.args];
                args[call.arraySlot] = invalid;
                expect(() => invoke(raw, call, args)).toThrow();
              }
              for (let index = 0; index < 4; index++)
                for (const invalid of [
                  NaN,
                  Infinity,
                  -Infinity,
                  "1",
                  undefined,
                ]) {
                  const cp: unknown[] = [2, -3, 5, -7];
                  cp[index] = invalid;
                  const args = [...call.args];
                  args[call.arraySlot] = cp;
                  expect(() => invoke(raw, call, args)).toThrow();
                }
              const args = [...call.args];
              args[call.arraySlot] = oversized(2147483648);
              expect(() => invoke(raw, call, args)).toThrow(RangeError);
              if (backend === "wasm") {
                args[call.arraySlot] = oversized(33554433);
                expect(() => invoke(raw, call, args)).toThrow(RangeError);
              }
            }
            if (call.pairSlot !== undefined)
              for (const invalid of [
                [],
                [1],
                [1, 2, 3],
                [NaN, 1],
                [1, Infinity],
                new Float64Array(2),
              ]) {
                const args = [...call.args];
                args[call.pairSlot] = invalid;
                expect(() => invoke(raw, call, args)).toThrow();
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
                expect(() => invoke(raw, call, args)).toThrow();
              }
          }
          for (const invalid of [-1, 0.5, 715827882, NaN, Infinity])
            expect(() => raw.chbder([1], [0, 1], 0, invalid)).toThrow(
              Number.isSafeInteger(invalid) ? RangeError : TypeError,
            );
          for (const invalid of [0.5, 2147483647, -2147483649, NaN, Infinity])
            expect(() => raw.polyds([1], invalid, 0)).toThrow(
              Number.isSafeInteger(invalid) ? RangeError : TypeError,
            );
          for (const name of ["chbder", "chbint", "chbval"] as const)
            expect(() =>
              Reflect.apply(raw[name], raw, [[], [0, 1], 0, 1]),
            ).toThrow();
          if (backend === "wasm") {
            expect(() => raw.chbder([1], [0, 1], 0, 11184810)).toThrow(
              RangeError,
            );
            expect(() => raw.polyds([1], 33554432, 0)).toThrow(RangeError);
          }
          expect(raw.failed()).toBe(false);
          expect(raw.polyds([1, 2], 1, 3)).toEqual([7, 2]);
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: owns derivative arrays and both root arrays after input and heap reuse`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const cp = [2, -3, 5, -7],
            pair: [number, number] = [10, 4];
          const derivatives = raw.chbder(cp, pair, 12, 6),
            power = raw.polyds(cp, 6, 0.5),
            roots = raw.rquad(1, 2, 5);
          const arrays = [derivatives, power, roots.root1, roots.root2],
            snapshots = arrays.map((a) => [...a]);
          expect(roots.root1).not.toBe(roots.root2);
          for (const array of arrays) expect(array).not.toBe(cp);
          cp.fill(99);
          pair.fill(-99);
          for (let i = 0; i < 20; i++) {
            raw.chbder([1, 2, 3, 4, 5], [0, 1], 0.25, 8);
            raw.polyds([], 5, 0);
            raw.rquad(1, -3, 2);
          }
          expect(arrays).toEqual(snapshots);
          for (const array of arrays) array.fill(123);
          expect(cp).toEqual([99, 99, 99, 99]);
          expect(pair).toEqual([-99, -99]);
          vectorClose(raw.rquad(1, 2, 5).root1, [-1, 2]);
          expect(raw.polyds([1, 2], 1, 3)).toEqual([7, 2]);
        } finally {
          await dispose();
        }
      },
    );
  }
});
