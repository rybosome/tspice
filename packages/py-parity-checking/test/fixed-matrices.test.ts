import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { Spice } from "@rybosome/tspice";
import { brandMat3RowMajor } from "@rybosome/tspice-core";
import { allCases } from "../src/cases/index.js";
import type { StepOutput } from "../src/case-types.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const identityValues = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;
const identity = brandMat3RowMajor(identityValues);
const aValues = [2, -3, 5, 7, 11, -13, 17, 19, 23] as const;
const a = brandMat3RowMajor(aValues);
const b = brandMat3RowMajor([-2, 4, 7, 3, -5, 11, 13, 17, -19]);
const nonsymmetric = brandMat3RowMajor([2, 1, 0, 0, 3, 1, 1, 0, 4]);
const diagonal = (x: number, y: number, z: number) =>
  brandMat3RowMajor([x, 0, 0, 0, y, 0, 0, 0, z]);
function expectComponents(
  actual: readonly number[],
  expected: readonly number[],
) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++)
    expect(actual[i]).toBeCloseTo(expected[i]!, 12);
}
function matrixComponents(output: StepOutput): number[] {
  switch (output.op) {
    case "coords-vectors.det":
    case "coords-vectors.trace":
      return [output.value];
    case "coords-vectors.invert":
    case "coords-vectors.invort":
      return output.value.flat();
    case "coords-vectors.diags2":
      return output.value.diag;
    default:
      throw new Error("Unexpected scaled matrix observation");
  }
}
const calls: {
  name: keyof Pick<
    Spice["raw"],
    | "det"
    | "invert"
    | "invort"
    | "isrot"
    | "mequ"
    | "mtxm"
    | "mxmt"
    | "trace"
    | "xpose"
  >;
  args: readonly unknown[];
  matrixSlots: readonly number[];
}[] = [
  { name: "det", args: [a], matrixSlots: [0] },
  { name: "invert", args: [a], matrixSlots: [0] },
  { name: "invort", args: [a], matrixSlots: [0] },
  { name: "isrot", args: [a, 0, 0], matrixSlots: [0] },
  { name: "mequ", args: [a], matrixSlots: [0] },
  { name: "mtxm", args: [a, b], matrixSlots: [0, 1] },
  { name: "mxmt", args: [a, b], matrixSlots: [0, 1] },
  { name: "trace", args: [a], matrixSlots: [0] },
  { name: "xpose", args: [a], matrixSlots: [0] },
];

describe("raw fixed matrices", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: compares exact copies and scaled tiny components to the actual live oracle`,
      async () => {
        const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const id of [
            "coords-vectors-ident-exact",
            "coords-vectors-mequ-finite-extremes",
            "coords-vectors-xpose-finite-extremes",
          ]) {
            const c = allCases.find((entry) => entry.caseId === id);
            if (!c) throw new Error(`Missing exact matrix case ${id}`);
            const oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toEqual(oracle.outputs);
          }
          for (const probe of [
            {
              id: "coords-vectors-det-scaled-magnitudes",
              scales: [1e150, 1e-150],
            },
            {
              id: "coords-vectors-trace-scaled-magnitudes",
              scales: [1e200, 1e-200],
            },
            {
              id: "coords-vectors-diags2-scaled-magnitudes",
              scales: [1e-200, 1e200],
            },
            {
              id: "coords-vectors-invert-finite-large-small-inverse",
              scales: [1e100, 1e-4],
            },
            {
              id: "coords-vectors-invort-scaled-magnitudes",
              scales: [1e200, 1e-200],
            },
          ]) {
            const c = allCases.find((entry) => entry.caseId === probe.id);
            if (!c) throw new Error(`Missing scaled matrix case ${probe.id}`);
            const oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toHaveLength(probe.scales.length);
            expect(oracle.outputs).toHaveLength(probe.scales.length);
            for (let i = 0; i < probe.scales.length; i++) {
              const left = actual.outputs[i],
                right = oracle.outputs[i],
                scale = probe.scales[i]!;
              if (!left || !right)
                throw new Error("Missing scaled matrix output");
              expect(left.op).toBe(right.op);
              const expected = matrixComponents(right).map(
                (value) => value * scale,
              );
              expect(expected.some((value) => Math.abs(value) > 0.1)).toBe(
                true,
              );
              expectComponents(
                matrixComponents(left).map((value) => value * scale),
                expected,
              );
              if (left.op === "coords-vectors.diags2" && right.op === left.op)
                expectComponents(left.value.rotate, right.value.rotate);
            }
          }
        } finally {
          await dispose();
        }
      },
      40_000,
    );

    testBackend(
      `${backend}: validates all matrix elements, shapes and tolerance arguments`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const malformed: unknown[] = [
            null,
            [],
            Array(8).fill(1),
            Array(10).fill(1),
            [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ],
          ];
          for (let i = 0; i < 9; i++)
            for (const value of [NaN, Infinity, -Infinity, "1", undefined]) {
              const values: unknown[] = [...aValues];
              values[i] = value;
              malformed.push(values);
            }
          for (const call of calls) {
            for (const slot of call.matrixSlots)
              for (const matrix of malformed) {
                const args = [...call.args];
                args[slot] = matrix;
                expect(() =>
                  Reflect.apply(raw[call.name], raw, args),
                ).toThrow();
              }
            expect(() =>
              Reflect.apply(raw[call.name], raw, call.args),
            ).not.toThrow();
          }
          for (const values of [
            null,
            [],
            [1, 2, 3],
            [1, 2, 3, 4, 5],
            [
              [1, 2],
              [2, 3],
            ],
          ])
            expect(() => Reflect.apply(raw.diags2, raw, [values])).toThrow();
          // Even the lower-left component ignored by CSPICE must satisfy the
          // public finite-input contract before reaching the native call.
          for (let i = 0; i < 4; i++)
            for (const invalid of [NaN, Infinity, -Infinity, "1", undefined]) {
              const values: unknown[] = [4, 1.5, 1.5, 1];
              values[i] = invalid;
              expect(() => Reflect.apply(raw.diags2, raw, [values])).toThrow();
            }
          for (const slot of [1, 2])
            for (const invalid of [
              NaN,
              Infinity,
              -Infinity,
              "1",
              null,
              undefined,
            ]) {
              const args: unknown[] = [identity, 0, 0];
              args[slot] = invalid;
              expect(() => Reflect.apply(raw.isrot, raw, args)).toThrow();
            }
          expect(raw.ident()).toEqual(identityValues);
          expect(raw.failed()).toBe(false);
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: preserves inverse threshold, column errors and tolerance recovery`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          for (const sign of [-1, 1]) {
            expect(raw.invert(diagonal(1, 1, sign * 5e-17))).toEqual(
              Array(9).fill(0),
            );
            expect(raw.invert(diagonal(1, 1, sign * 1e-16))[8] / 1e16).toBe(
              sign,
            );
            expect(raw.invert(diagonal(1, 1, sign * 2e-16))[8] / 5e15).toBe(
              sign,
            );
          }
          expectComponents(
            raw.mxm(nonsymmetric, raw.invert(nonsymmetric)),
            identityValues,
          );
          const pseudo = raw.invort(nonsymmetric);
          expectComponents(pseudo, [
            0.4,
            0,
            0.2,
            0.1,
            0.3,
            0,
            0,
            1 / 17,
            4 / 17,
          ]);
          expect(pseudo).not.toEqual(raw.invert(nonsymmetric));
          for (let column = 0; column < 3; column++)
            for (const [length, error] of [
              [0, "ZEROLENGTHCOLUMN"],
              [Number.MIN_VALUE, "COLUMNTOOSMALL"],
            ] as const) {
              const values = [1, 1, 1];
              values[column] = length;
              expect(() =>
                raw.invort(diagonal(values[0]!, values[1]!, values[2]!)),
              ).toThrow(error);
              expect(raw.invort(identity)).toEqual(identityValues);
              expect(raw.failed()).toBe(false);
            }
          expect(raw.invort(diagonal(1e-308, 1, 1))[0] / 1e308).toBeCloseTo(
            1,
            12,
          );
          expect(raw.isrot(identity, 0, 0)).toBe(true);
          expect(raw.isrot(diagonal(-1, 1, 1), 0, 0)).toBe(false);
          expect(raw.isrot(diagonal(1.125, 1, 1), 0.125, 0)).toBe(true);
          expect(raw.isrot(diagonal(1.125, 1, 1), 0.124, 0)).toBe(false);
          expect(raw.isrot(diagonal(0, 0, 0), 1, 1)).toBe(true);
          expect(raw.isrot(diagonal(-1, 1, 1), 0, 2)).toBe(true);
          for (const [ntol, dtol] of [
            [-0.125, 0],
            [0, -0.125],
          ]) {
            expect(() => raw.isrot(identity, ntol!, dtol!)).toThrow(
              /VALUEOUTOFRANGE/,
            );
            expect(raw.isrot(identity, 0, 0)).toBe(true);
            expect(raw.failed()).toBe(false);
          }
        } finally {
          try {
            raw.reset();
            raw.kclear();
          } finally {
            await dispose();
          }
        }
      },
    );

    testBackend(
      `${backend}: distinguishes row-major products and every diags2 field`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          expect(raw.det(a)).toBe(1876);
          expect(raw.trace(a)).toBe(36);
          expect(raw.xpose(a)).toEqual([2, 7, 17, -3, 11, 19, 5, -13, 23]);
          expect(raw.mtxm(a, b)).toEqual([
            238, 262, -232, 286, 256, -261, 250, 476, -545,
          ]);
          expect(raw.mxmt(a, b)).toEqual([
            19, 76, -120, -61, -177, 525, 203, 209, 107,
          ]);
          expect(raw.diags2([5, 0, -99, -3])).toEqual({
            diag: [5, 0, 0, -3],
            rotate: [1, 0, 0, 1],
          });
          const result = raw.diags2([4, 1.5, 1.5, 1]);
          expectComponents(result.diag, [
            2.5 + 1.5 * Math.SQRT2,
            0,
            0,
            2.5 - 1.5 * Math.SQRT2,
          ]);
          expectComponents(result.rotate, [
            Math.cos(Math.PI / 8),
            -Math.sin(Math.PI / 8),
            Math.sin(Math.PI / 8),
            Math.cos(Math.PI / 8),
          ]);
          expect(raw.diags2([4, 1.5, -99, 1])).toEqual(result);
          expect(raw.diags2([4, 1.5, Number.MAX_VALUE, 1])).toEqual(result);
          const negativeOffDiagonal = raw.diags2([4, -1.5, -1.5, 1]);
          expectComponents(negativeOffDiagonal.rotate, [
            Math.cos(Math.PI / 8),
            Math.sin(Math.PI / 8),
            -Math.sin(Math.PI / 8),
            Math.cos(Math.PI / 8),
          ]);
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: keeps owned outputs and exact copied bits through input mutation and heap reuse`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const input = [
            -0,
            Number.MIN_VALUE,
            Number.MAX_VALUE,
            4,
            -5,
            6,
            7,
            8,
            9,
          ];
          const source = brandMat3RowMajor(input, { freeze: "never" });
          const copied = raw.mequ(source),
            transposed = raw.xpose(source),
            firstIdentity = raw.ident();
          expect(copied).not.toBe(source);
          expect(transposed).not.toBe(source);
          expect(firstIdentity).not.toBe(raw.ident());
          expect(copied).toEqual(input);
          expect(transposed).toEqual([
            -0,
            4,
            7,
            Number.MIN_VALUE,
            -5,
            8,
            Number.MAX_VALUE,
            6,
            9,
          ]);
          expect(Object.is(copied[0], -0)).toBe(true);
          expect(Object.is(transposed[0], -0)).toBe(true);
          const symmat: [number, number, number, number] = [4, 1.5, 1.5, 1];
          const diagonalized = raw.diags2(symmat);
          expect(diagonalized.diag).not.toBe(symmat);
          expect(diagonalized.rotate).not.toBe(diagonalized.diag);
          const results = {
            copied,
            transposed,
            firstIdentity,
            diagonalized,
            inverted: raw.invert(nonsymmetric),
            inverseOrthogonal: raw.invort(nonsymmetric),
            left: raw.mtxm(a, b),
            right: raw.mxmt(a, b),
          };
          const snapshot = structuredClone(results);
          expect(Reflect.set(source, "1", 42)).toBe(true);
          symmat[1] = 99;
          for (let i = 1; i <= 8; i++) {
            for (const call of calls)
              Reflect.apply(raw[call.name], raw, call.args);
            raw.diags2([1, 0.25, 0.25, 2]);
            raw.ident();
          }
          expect(results).toEqual(snapshot);
          expect(copied[1]).toBe(Number.MIN_VALUE);
          diagonalized.diag[0] = 99;
          expect(diagonalized.rotate).toEqual(snapshot.diagonalized.rotate);
        } finally {
          await dispose();
        }
      },
    );
  }
});
