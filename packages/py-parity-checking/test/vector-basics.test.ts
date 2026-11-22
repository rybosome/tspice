import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const unary = ["vequ", "vupack", "vzero", "unorm"] as const;
const binary = ["vdist", "ucrss", "vsep"] as const;
function expectVectorClose(
  actual: readonly number[],
  expected: readonly number[],
) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++)
    expect(actual[i]).toBeCloseTo(expected[i]!, 12);
}

describe("raw vector basics", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: preserves complete copy/pack/unpack components against the live oracle`,
      async () => {
        const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const name of ["vequ", "vpack", "vupack"]) {
            const c = allCases.find(
              (c) => c.caseId === `coords-vectors-${name}-finite-extremes`,
            );
            if (!c)
              throw new Error(`Missing exact copy parity case for ${name}`);
            const oracle = await runCaseInSidecar(c, fixturesRoot);
            const actual = runCaseInTspice(spice, c, fixturesRoot);
            expect(oracle.ok).toBe(true);
            expect(actual.ok).toBe(true);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            // Copy operations require exact bits for these finite values; normal
            // absolute/relative tolerance can hide a subnormal zero or lost bits.
            expect(actual.outputs).toEqual(oracle.outputs);
          }
        } finally {
          await dispose();
        }
      },
      20_000,
    );

    testBackend(
      `${backend}: validates every scalar/vector input and recovers on the same client`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const valid = Object.freeze([1.25, -2.5, 7.75] as const);
          for (const vector of [
            [],
            [1, 2],
            [1, 2, 3, 4],
            [NaN, 2, 3],
            [1, Infinity, 3],
            [1, 2, -Infinity],
            [1, "2", 3],
            [1, undefined, 3],
            null,
          ]) {
            for (const method of unary)
              expect(() => Reflect.apply(raw[method], raw, [vector])).toThrow();
            for (const method of binary) {
              expect(() =>
                Reflect.apply(raw[method], raw, [vector, valid]),
              ).toThrow();
              expect(() =>
                Reflect.apply(raw[method], raw, [valid, vector]),
              ).toThrow();
            }
          }
          for (let position = 0; position < 3; position++) {
            for (const value of [
              NaN,
              Infinity,
              -Infinity,
              "1",
              null,
              undefined,
              true,
            ]) {
              const args: unknown[] = [1, 2, 3];
              args[position] = value;
              expect(() => Reflect.apply(raw.vpack, raw, args)).toThrow();
            }
          }
          for (const method of unary)
            expect(() => raw[method](valid)).not.toThrow();
          for (const method of binary)
            expect(() => raw[method](valid, valid)).not.toThrow();
          expect(raw.vpack(1, 2, 3)).toEqual([1, 2, 3]);
          expect(raw.failed()).toBe(false);
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: observes zero, subnormal, handedness and scaled normalization semantics`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          expect(raw.vzero([0, -0, 0])).toBe(true);
          for (const v of [
            [Number.MIN_VALUE, 0, 0],
            [0, -Number.MIN_VALUE, 0],
            [0, 0, Number.MIN_VALUE],
          ] as const)
            expect(raw.vzero(v)).toBe(false);
          expect(raw.unorm([0, 0, 0])).toEqual({ unit: [0, 0, 0], norm: 0 });
          expect(raw.unorm([Number.MIN_VALUE, 0, 0])).toEqual({
            unit: [1, 0, 0],
            norm: Number.MIN_VALUE,
          });
          // Power-of-two scaling makes the products exactly representable. At
          // non-dyadic collinear inputs (such as [1, 2, 3] and [2, 4, 6]),
          // fused multiply-add can leave a cancellation residual that ucrss
          // normalizes to a unit vector; zero is not portable at that boundary.
          expect(raw.ucrss([1, 2, 4], [2, 4, 8])).toEqual([0, 0, 0]);
          expect(raw.ucrss([1, 2, 4], [-2, -4, -8])).toEqual([0, 0, 0]);
          expect(raw.ucrss([0, 0, 0], [1, 2, 3])).toEqual([0, 0, 0]);
          expectVectorClose(raw.ucrss([1, 0, 0], [0, 2, 0]), [0, 0, 1]);
          expectVectorClose(raw.ucrss([0, 2, 0], [1, 0, 0]), [0, 0, -1]);
          expect(raw.vsep([0, 0, 0], [1, 2, 3])).toBe(0);
          expect(raw.vsep([1, 2, 3], [0, 0, 0])).toBe(0);
          expect(raw.vsep([1, 2, 3], [2, 4, 6])).toBe(0);
          expect(raw.vsep([1, 2, 3], [-2, -4, -6])).toBeCloseTo(Math.PI, 12);
          expect(raw.vsep([1, 0, 0], [0, -2, 0])).toBeCloseTo(Math.PI / 2, 12);
          expect(raw.vsep([1, 0, 0], [1, 1e-9, 0]) / 1e-9).toBeCloseTo(1, 12);
          for (const scale of [1e-200, 1, 1e200]) {
            const v: [number, number, number] = [
              3 * scale,
              -4 * scale,
              12 * scale,
            ];
            const normalized = raw.unorm(v);
            expect(normalized.norm / scale).toBeCloseTo(13, 12);
            expectVectorClose(normalized.unit, [3 / 13, -4 / 13, 12 / 13]);
            expect(raw.vdist(v, [0, 0, 0]) / scale).toBeCloseTo(13, 12);
            expectVectorClose(
              raw.ucrss([scale, 0, 0], [0, -scale, 0]),
              [0, 0, -1],
            );
          }
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: returns owned copies that survive caller mutation and heap reuse`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const source: [number, number, number] = [
            -0,
            Number.MIN_VALUE,
            Number.MAX_VALUE,
          ];
          const copied = raw.vequ(source);
          const packed = raw.vpack(...source);
          const unpacked = raw.vupack(source);
          expect(copied).not.toBe(source);
          expect(copied).toEqual(source);
          expect(packed).toEqual(source);
          expect(unpacked).toEqual({
            x: source[0],
            y: source[1],
            z: source[2],
          });
          expect(Object.is(copied[0], -0)).toBe(true);
          expect(Object.is(packed[0], -0)).toBe(true);
          expect(Object.is(unpacked.x, -0)).toBe(true);
          source[1] = 42;
          expect(copied[1]).toBe(Number.MIN_VALUE);
          expect(packed[1]).toBe(Number.MIN_VALUE);
          expect(unpacked.y).toBe(Number.MIN_VALUE);
          copied[2] = 17;
          expect(source[2]).toBe(Number.MAX_VALUE);
          expect(packed[2]).toBe(Number.MAX_VALUE);
          const normalized = raw.unorm([3, -4, 12]);
          const crossed = raw.ucrss([1, -2, 3], [4, 5, -6]);
          const snapshot = structuredClone({
            copied,
            packed,
            unpacked,
            normalized,
            crossed,
          });
          for (let i = 1; i <= 8; i++) {
            raw.vequ([i, -i, 2 * i]);
            raw.vpack(i, 2 * i, -3 * i);
            raw.vupack([i, -2 * i, 4 * i]);
            raw.unorm([i, -2 * i, 3 * i]);
            raw.ucrss([i, 0, 0], [0, i, 0]);
          }
          expect({ copied, packed, unpacked, normalized, crossed }).toEqual(
            snapshot,
          );
          const roundTrip = raw.vupack(raw.vpack(-2.5, 7.75, 0.125));
          expect(roundTrip).toEqual({ x: -2.5, y: 7.75, z: 0.125 });
        } finally {
          await dispose();
        }
      },
    );
  }
});
