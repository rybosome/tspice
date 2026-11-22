import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const doubleArrays = ["sumad", "maxd", "mind"] as const;
const integerArrays = ["sumai", "maxi", "mini"] as const;
const variadic = ["maxd", "mind", "maxi", "mini"] as const;
describe("raw scalar math", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: compares every portable variadic arity to the independent actual C oracle`,
      async () => {
        const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const name of variadic) {
            const c = allCases.find(
              (entry) =>
                entry.caseId === `coords-vectors-${name}-all-portable-arities`,
            );
            if (!c)
              throw new Error(`Missing independent variadic case ${name}`);
            const oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toHaveLength(60);
            // Min/max returns one supplied value exactly, including extrema.
            expect(actual.outputs).toEqual(oracle.outputs);
          }
        } finally {
          await dispose();
        }
      },
      30_000,
    );

    testBackend(
      `${backend}: keeps exact integer/extreme results and tiny scalar outputs observable`,
      async () => {
        const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const id of [
            "brcktd-finite-extrema",
            "brckti-signed32-extrema",
            "sumad-finite-extrema",
            "sumai-safe-prefix-signed32-extrema",
            "maxd-finite-extrema",
            "mind-finite-extrema",
            "maxi-signed32-extrema",
            "mini-signed32-extrema",
          ]) {
            const c = allCases.find(
              (entry) => entry.caseId === `coords-vectors-${id}`,
            );
            if (!c) throw new Error(`Missing exact scalar case ${id}`);
            const oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toEqual(oracle.outputs);
          }
          const c = allCases.find(
            (entry) =>
              entry.caseId === "coords-vectors-convrt-scaled-magnitudes",
          );
          if (!c) throw new Error("Missing scaled conversion case");
          const oracle = await runCaseInSidecar(c, fixturesRoot),
            actual = runCaseInTspice(spice, c, fixturesRoot);
          if (!oracle.ok) throw new Error(oracle.error.message);
          if (!actual.ok) throw new Error(actual.error.message);
          expect(actual.outputs).toHaveLength(2);
          expect(oracle.outputs).toHaveLength(2);
          for (let i = 0; i < 2; i++) {
            const left = actual.outputs[i],
              right = oracle.outputs[i],
              scale = i === 0 ? 1e-203 : 1e197;
            if (left?.op !== "coords-vectors.convrt" || right?.op !== left.op)
              throw new Error("Missing conversion scalar");
            expect(right.value * scale).toBeCloseTo(1, 12);
            expect(left.value * scale).toBeCloseTo(right.value * scale, 12);
          }
          expect(spice.raw.sumad([1e200, -1e200, 1e-200]) / 1e-200).toBe(1);
        } finally {
          await dispose();
        }
      },
      40_000,
    );

    testBackend(
      `${backend}: validates scalar and array boundaries without truncation or coercion`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          for (let slot = 0; slot < 3; slot++) {
            for (const invalid of [
              NaN,
              Infinity,
              -Infinity,
              "1",
              null,
              undefined,
            ]) {
              const args: unknown[] = [1, -2, 3];
              args[slot] = invalid;
              expect(() => Reflect.apply(raw.brcktd, raw, args)).toThrow();
            }
            for (const invalid of [
              0.5,
              2147483648,
              -2147483649,
              NaN,
              Infinity,
              "1",
              null,
              undefined,
            ]) {
              const args: unknown[] = [1, -2, 3];
              args[slot] = invalid;
              expect(() => Reflect.apply(raw.brckti, raw, args)).toThrow();
            }
          }
          for (const invalid of [
            NaN,
            Infinity,
            -Infinity,
            "1",
            null,
            undefined,
          ])
            expect(() =>
              Reflect.apply(raw.convrt, raw, [invalid, "KM", "M"]),
            ).toThrow();
          for (const slot of [1, 2])
            for (const invalid of [1, null, undefined, "KM\0M"]) {
              const args: unknown[] = [1, "KM", "M"];
              args[slot] = invalid;
              expect(() => Reflect.apply(raw.convrt, raw, args)).toThrow();
            }
          for (const invalid of [null, {}, "1,2", new Float64Array([1, 2])]) {
            for (const name of [...doubleArrays, ...integerArrays])
              expect(() => Reflect.apply(raw[name], raw, [invalid])).toThrow();
          }
          for (let slot = 0; slot < 3; slot++) {
            for (const invalid of [NaN, Infinity, -Infinity, "1", undefined]) {
              const values: unknown[] = [1, 2, 3];
              values[slot] = invalid;
              for (const name of doubleArrays)
                expect(() => Reflect.apply(raw[name], raw, [values])).toThrow();
            }
            for (const invalid of [
              0.5,
              2147483648,
              -2147483649,
              NaN,
              Infinity,
              "1",
              undefined,
            ]) {
              const values: unknown[] = [1, 2, 3];
              values[slot] = invalid;
              for (const name of integerArrays)
                expect(() => Reflect.apply(raw[name], raw, [values])).toThrow();
            }
          }
          for (const name of variadic) {
            expect(() => raw[name](Array(31).fill(1))).toThrow(/30/);
            expect(raw[name]([])).toBe(0);
            expect(raw[name](Object.freeze([1, -2, 3]))).toBe(
              name.startsWith("max") ? 3 : -2,
            );
          }
          expect(raw.sumad(Array(64).fill(1))).toBe(64);
          expect(raw.sumai(Array(64).fill(1))).toBe(64);
          expect(raw.failed()).toBe(false);
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: preserves reversed bounds, conversion tables and ordered floating sums`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          for (const bracket of [raw.brcktd, raw.brckti]) {
            expect(bracket(-7, 3, -2)).toBe(-2);
            expect(bracket(8, 3, -2)).toBe(3);
            expect(bracket(1, 3, -2)).toBe(1);
            expect(bracket(8, 2, 2)).toBe(2);
          }
          expect(raw.convrt(1, "kIlOmEtErS", "mEtErS")).toBe(1000);
          expect(raw.convrt(1, "KM ", "M ")).toBe(1000);
          expect(raw.convrt(1, "YEARS", "DAYS")).toBe(365.25);
          // These are the pinned N0067 conversion-table values, not modern
          // replacements or an equivalence to the separate tyear constant.
          expect(raw.convrt(1, "AU", "KM")).toBe(149597870.6136889);
          expect(raw.convrt(1, "TROPICAL_YEARS", "SECONDS")).toBe(
            31556925.97632,
          );
          expect(raw.convrt(180, "DEGREES", "RADIANS")).toBeCloseTo(
            Math.PI,
            12,
          );
          for (const [input, output, error] of [
            [" KM", "M", "UNITSNOTREC"],
            ["METER", "KM", "UNITSNOTREC"],
            ["KM", "SECONDS", "INCOMPATIBLEUNITS"],
            ["", "M", "EMPTYSTRING"],
            ["M", "", "EMPTYSTRING"],
          ]) {
            expect(() => raw.convrt(1, input!, output!)).toThrow(error);
            expect(raw.convrt(1, "KM", "M")).toBe(1000);
            expect(raw.failed()).toBe(false);
          }
          expect(raw.sumad([1e16, 1, -1e16])).toBe(0);
          expect(raw.sumad([1e16, -1e16, 1])).toBe(1);
          expect(raw.sumad([])).toBe(0);
          expect(raw.sumai([])).toBe(0);
        } finally {
          try {
            raw.reset();
          } finally {
            await dispose();
          }
        }
      },
    );

    testBackend(
      `${backend}: rejects unsafe integer prefixes without invoking undefined CSPICE behavior`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          // These are wrapper-safety checks, not scientific oracle comparisons:
          // actual C signed overflow is undefined even if a later value cancels it.
          for (const values of [
            [2147483647, 1],
            [-2147483648, -1],
            [2147483647, 1, -1],
            [-2147483648, -1, 1],
          ]) {
            const input = Object.freeze(values);
            expect(() => raw.sumai(input)).toThrow(/prefix.*signed 32-bit/i);
            expect(raw.failed()).toBe(false);
            expect(raw.sumai([2147483647, -2147483647, 1])).toBe(1);
          }
          expect(raw.sumai([1073741823, 1073741824])).toBe(2147483647);
          expect(raw.sumai([-1073741824, -1073741824])).toBe(-2147483648);
        } finally {
          await dispose();
        }
      },
    );
  }
});
