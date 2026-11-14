import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { assertCaseParity } from "../src/parity-assert.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const binary = ["ducrss", "dvcrss", "dvdot", "dvsep"] as const;
const unary = ["dvhat", "dvnorm"] as const;
const names = [...binary, ...unary] as const;
const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");
function caseFor(suffix: string) {
  const result = allCases.find((c) => c.caseId === `coords-vectors-${suffix}`);
  if (!result) throw new Error(`Missing state-derivative case ${suffix}`);
  return result;
}
function vectorClose(actual: readonly number[], expected: readonly number[]) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++)
    expect(actual[i]).toBeCloseTo(expected[i]!, 12);
}

describe("raw state derivatives", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: observes all position and derivative components at small and large scales`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const name of names)
            for (const kind of [
              "scaled-states",
              "scaled-derivatives",
            ] as const) {
              const c = caseFor(`${name}-${kind}`),
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
                  throw new Error("Missing scaled state output");
                const derivativeScale = i === 0 ? 1e-100 : 1e100;
                const uniformScale =
                  kind === "scaled-derivatives"
                    ? derivativeScale
                    : name === "dvcrss" || name === "dvdot"
                      ? i === 0
                        ? 1e-200
                        : 1e200
                      : name === "dvnorm"
                        ? derivativeScale
                        : 1;
                if (
                  typeof left.value === "number" &&
                  typeof right.value === "number"
                ) {
                  expect(Math.abs(right.value * uniformScale)).toBeGreaterThan(
                    0.01,
                  );
                  expect(left.value * uniformScale).toBeCloseTo(
                    right.value * uniformScale,
                    12,
                  );
                } else if (
                  (left.op === "coords-vectors.ducrss" ||
                    left.op === "coords-vectors.dvcrss" ||
                    left.op === "coords-vectors.dvhat") &&
                  (right.op === "coords-vectors.ducrss" ||
                    right.op === "coords-vectors.dvcrss" ||
                    right.op === "coords-vectors.dvhat")
                ) {
                  const scale = (value: number, index: number) =>
                    value *
                    (kind === "scaled-derivatives"
                      ? index < 3
                        ? 1
                        : derivativeScale
                      : uniformScale);
                  const a = left.value.map(scale),
                    b = right.value.map(scale);
                  vectorClose(a, b);
                  expect(b).toHaveLength(6);
                  expect(
                    b.slice(0, 3).some((value) => Math.abs(value) > 0.01),
                  ).toBe(true);
                  expect(
                    b.slice(3).some((value) => Math.abs(value) > 0.01),
                  ).toBe(true);
                } else
                  throw new Error("Unexpected state derivative result shape");
              }
            }
        } finally {
          await dispose();
        }
      },
      40_000,
    );

    testBackend(
      `${backend}: preserves actual singular-state conventions and exact copied extrema`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const suffix of [
            "ducrss-dyadic-collinear-states",
            "dvcrss-dyadic-collinear-states",
            "dvsep-axis-collinear-states",
            "dvhat-zero-position-exact-extrema",
          ]) {
            const c = caseFor(suffix),
              oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            assertCaseParity(c, oracle, actual);
            if (suffix === "dvhat-zero-position-exact-extrema")
              expect(actual.outputs).toEqual(oracle.outputs);
          }
          const a = [2, 0, 0, 0, 2, 0] as const,
            b = [4, 0, 0, 0, 0, 4] as const;
          expect(spice.raw.ducrss(a, b)).toEqual([0, 0, 0, 0, -1, -1]);
          expect(spice.raw.dvcrss(a, b)).toEqual([0, 0, 0, 0, -8, -8]);
          expect(spice.raw.dvhat([0, 0, 0, 2, -3, 4])).toEqual([
            0, 0, 0, 2, -3, 4,
          ]);
          expect(spice.raw.dvnorm([0, 0, 0, 2, -3, 4])).toBe(0);
          expect(spice.raw.dvsep(a, b)).toBe(0);
        } finally {
          await dispose();
        }
      },
      25_000,
    );

    testBackend(
      `${backend}: distinguishes six-state layout, cross-product order and angular rate sign`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const a = Object.freeze([2, 0, 0, 0, 2, 0] as const),
            b = Object.freeze([0, 4, 0, 0, 0, 4] as const);
          vectorClose(raw.dvcrss(a, b), [0, 0, 8, 0, -8, 0]);
          vectorClose(raw.dvcrss(b, a), [0, 0, -8, 0, 8, 0]);
          vectorClose(raw.ducrss(a, b), [0, 0, 1, 0, -1, 0]);
          expect(raw.dvdot(a, b)).toBe(8);
          expect(raw.dvdot(b, a)).toBe(8);
          vectorClose(raw.dvhat(a), [1, 0, 0, 0, 1, 0]);
          expect(raw.dvnorm([2, 0, 0, 3, 4, 5])).toBe(3);
          expect(raw.dvnorm([-2, 0, 0, 3, 4, 5])).toBe(-3);
          expect(raw.dvsep(a, b)).toBe(-1);
          expect(raw.dvsep(b, a)).toBe(-1);
          expect(raw.dvsep([2, 0, 0, 0, -2, 0], b)).toBe(1);
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: retains guarded tiny rates and recovers after genuine decimal overflow errors`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          const c = caseFor("dvsep-division-underflow-and-finite-boundary");
          const oracle = await runCaseInSidecar(c, fixturesRoot),
            actual = runCaseInTspice(spice, c, fixturesRoot);
          if (!oracle.ok) throw new Error(oracle.error.message);
          if (!actual.ok) throw new Error(actual.error.message);
          expect(actual.outputs).toHaveLength(6);
          expect(oracle.outputs).toHaveLength(6);
          for (let i = 0; i < 6; i++) {
            const left = actual.outputs[i],
              right = oracle.outputs[i];
            if (left?.op !== "coords-vectors.dvsep" || right?.op !== left.op)
              throw new Error("Missing division observation");
            if (i < 2) expect(left.value).toBe(0);
            else {
              const scale = i < 4 ? 1e306 : 1e-308;
              expect(Math.abs(right.value * scale)).toBeCloseTo(1, 12);
              expect(left.value * scale).toBeCloseTo(right.value * scale, 12);
            }
          }
          const b = [0, 1, 0, 0, 0, 0] as const;
          for (const sign of [1, -1]) {
            const errorCase = caseFor(
              `dvsep-decimal-overflow-${sign === 1 ? "positive" : "negative"}`,
            );
            const independent = await runCaseInSidecar(errorCase, fixturesRoot);
            expect(independent.ok).toBe(false);
            if (independent.ok)
              throw new Error("Missing independent NUMERICOVERFLOW");
            expect(independent.error.message).toContain("NUMERICOVERFLOW");
            expect(() =>
              spice.raw.dvsep([1, 0, 0, 0, sign * 1.5e308, 0], b),
            ).toThrow(/NUMERICOVERFLOW/);
            expect(spice.raw.failed()).toBe(false);
            expect(spice.raw.dvsep([1, 0, 0, 0, 2, 0], b)).toBe(-2);
            expect(spice.raw.dvhat([1, 0, 0, 0, 1e-308, 0])[4] / 1e-308).toBe(
              1,
            );
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
      `${backend}: validates every state component and returns owned copied arrays`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          for (const name of names) {
            const slots = name === "dvhat" || name === "dvnorm" ? [0] : [0, 1];
            for (const slot of slots) {
              for (const invalid of [
                null,
                {},
                "1,2",
                new Float64Array(6),
                [],
                [1, 2, 3],
                [1, 2, 3, 4, 5],
                [1, 2, 3, 4, 5, 6, 7],
              ]) {
                const args: unknown[] = [
                  [1, -2, 4, 3, -5, 7],
                  [-3, 5, 7, 11, 13, -17],
                ];
                args[slot] = invalid;
                expect(() => Reflect.apply(raw[name], raw, args)).toThrow();
              }
              for (let component = 0; component < 6; component++)
                for (const invalid of [
                  NaN,
                  Infinity,
                  -Infinity,
                  "1",
                  undefined,
                ]) {
                  const state: unknown[] = [1, -2, 4, 3, -5, 7];
                  state[component] = invalid;
                  const args: unknown[] = [
                    [1, -2, 4, 3, -5, 7],
                    [-3, 5, 7, 11, 13, -17],
                  ];
                  args[slot] = state;
                  expect(() => Reflect.apply(raw[name], raw, args)).toThrow();
                }
            }
          }
          const a: [number, number, number, number, number, number] = [
              1, -2, 4, 3, -5, 7,
            ],
            b: [number, number, number, number, number, number] = [
              -3, 5, 7, 11, 13, -17,
            ];
          const outputs = [raw.ducrss(a, b), raw.dvcrss(a, b), raw.dvhat(a)],
            snapshots = outputs.map((output) => [...output]);
          for (const output of outputs) {
            expect(output).not.toBe(a);
            expect(output).not.toBe(b);
          }
          a.fill(99);
          b.fill(-99);
          for (let i = 0; i < 20; i++) {
            raw.ducrss([2, 0, 0, 0, 2, 0], [0, 4, 0, 0, 0, 4]);
            raw.dvhat([0, 0, 0, 2, -3, 4]);
          }
          expect(outputs).toEqual(snapshots);
          for (const output of outputs) output.fill(123);
          expect(a).toEqual([99, 99, 99, 99, 99, 99]);
          expect(b).toEqual([-99, -99, -99, -99, -99, -99]);
          expect(raw.dvhat([0, 0, 0, 2, -3, 4])).toEqual([0, 0, 0, 2, -3, 4]);
          expect(raw.failed()).toBe(false);
        } finally {
          await dispose();
        }
      },
    );
  }
});
