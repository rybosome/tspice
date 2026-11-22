import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { Spice } from "@rybosome/tspice";
import { brandMat3RowMajor } from "@rybosome/tspice-core";
import { allCases } from "../src/cases/index.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const matrixValues = [2, -3, 5, 7, 11, -13, 17, 19, 23] as const;
const matrix = brandMat3RowMajor(matrixValues);
function expectVectorClose(
  actual: readonly number[],
  expected: readonly number[],
) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++)
    expect(actual[i]).toBeCloseTo(expected[i]!, 12);
}

const boundaryCalls: {
  name: keyof Pick<
    Spice["raw"],
    | "vlcom"
    | "vlcom3"
    | "vperp"
    | "vproj"
    | "vrel"
    | "vrotv"
    | "rotvec"
    | "vtmv"
  >;
  args: readonly unknown[];
  vectorSlots: readonly number[];
  scalarSlots: readonly number[];
}[] = [
  {
    name: "vlcom",
    args: [2, [1, -2, 4], -3, [5, 7, -11]],
    vectorSlots: [1, 3],
    scalarSlots: [0, 2],
  },
  {
    name: "vlcom3",
    args: [2, [1, -2, 4], -3, [5, 7, -11], 0.5, [-13, 17, 19]],
    vectorSlots: [1, 3, 5],
    scalarSlots: [0, 2, 4],
  },
  {
    name: "vperp",
    args: [
      [1, -2, 4],
      [5, 7, -11],
    ],
    vectorSlots: [0, 1],
    scalarSlots: [],
  },
  {
    name: "vproj",
    args: [
      [1, -2, 4],
      [5, 7, -11],
    ],
    vectorSlots: [0, 1],
    scalarSlots: [],
  },
  {
    name: "vrel",
    args: [
      [1, -2, 4],
      [5, 7, -11],
    ],
    vectorSlots: [0, 1],
    scalarSlots: [],
  },
  {
    name: "vrotv",
    args: [[1, -2, 4], [2, -3, 5], 0.7],
    vectorSlots: [0, 1],
    scalarSlots: [2],
  },
  {
    name: "rotvec",
    args: [[1, -2, 4], 0.7, 3],
    vectorSlots: [0],
    scalarSlots: [1],
  },
  {
    name: "vtmv",
    args: [[1, -2, 4], matrix, [5, 7, -11]],
    vectorSlots: [0, 2],
    scalarSlots: [],
  },
];

describe("raw vector combinations", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: keeps tiny components observable against the actual live oracle`,
      async () => {
        const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          const probes = [
            {
              id: "coords-vectors-vlcom-scaled-magnitudes",
              scales: [1e-200, 1e200],
            },
            {
              id: "coords-vectors-vlcom3-scaled-magnitudes",
              scales: [1e-200, 1e200],
            },
            {
              id: "coords-vectors-vproj-input-scaled-magnitudes",
              scales: [1e-200, 1e200],
            },
            {
              id: "coords-vectors-vperp-input-scaled-magnitudes",
              scales: [1e-200, 1e200],
            },
            {
              id: "coords-vectors-vrel-nearby-large-components",
              scales: [1e15],
            },
          ];
          for (const probe of probes) {
            const c = allCases.find((entry) => entry.caseId === probe.id);
            if (!c)
              throw new Error(`Missing scaled observation case ${probe.id}`);
            const oracle = await runCaseInSidecar(c, fixturesRoot);
            const actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toHaveLength(probe.scales.length);
            expect(oracle.outputs).toHaveLength(probe.scales.length);
            for (let i = 0; i < probe.scales.length; i++) {
              const left = actual.outputs[i],
                right = oracle.outputs[i],
                scale = probe.scales[i]!;
              if (!left || !right)
                throw new Error("Missing scaled vector observation");
              if (left.op === "coords-vectors.vrel" && right.op === left.op) {
                expect(right.value * scale).toBeGreaterThan(1);
                expect(left.value * scale).toBeCloseTo(right.value * scale, 12);
              } else if (
                (left.op === "coords-vectors.vlcom" ||
                  left.op === "coords-vectors.vlcom3" ||
                  left.op === "coords-vectors.vproj" ||
                  left.op === "coords-vectors.vperp") &&
                (right.op === "coords-vectors.vlcom" ||
                  right.op === "coords-vectors.vlcom3" ||
                  right.op === "coords-vectors.vproj" ||
                  right.op === "coords-vectors.vperp")
              ) {
                expect(left.op).toBe(right.op);
                expectVectorClose(
                  left.value.map((value) => value * scale),
                  right.value.map((value) => value * scale),
                );
                expect(
                  right.value.some((value) => Math.abs(value * scale) > 0.1),
                ).toBe(true);
              } else throw new Error("Unexpected scaled observation operation");
            }
          }
        } finally {
          await dispose();
        }
      },
      30_000,
    );

    testBackend(
      `${backend}: validates every argument slot and recovers on the same client`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const malformedVectors: unknown[] = [[], [1, 2], [1, 2, 3, 4], null];
          for (let component = 0; component < 3; component++) {
            for (const invalid of [NaN, Infinity, -Infinity, "2", undefined]) {
              const vector: unknown[] = [1, 2, 3];
              vector[component] = invalid;
              malformedVectors.push(vector);
            }
          }
          for (const call of boundaryCalls) {
            for (const slot of call.vectorSlots)
              for (const vector of malformedVectors) {
                const args = [...call.args];
                args[slot] = vector;
                expect(() =>
                  Reflect.apply(raw[call.name], raw, args),
                ).toThrow();
              }
            for (const slot of call.scalarSlots)
              for (const invalid of [
                NaN,
                Infinity,
                -Infinity,
                "1",
                null,
                undefined,
                true,
              ]) {
                const args = [...call.args];
                args[slot] = invalid;
                expect(() =>
                  Reflect.apply(raw[call.name], raw, args),
                ).toThrow();
              }
            expect(() =>
              Reflect.apply(raw[call.name], raw, call.args),
            ).not.toThrow();
          }
          for (const axis of [
            0.5,
            NaN,
            Infinity,
            -Infinity,
            2147483648,
            -2147483649,
            "3",
            null,
            undefined,
          ]) {
            expect(() =>
              Reflect.apply(raw.rotvec, raw, [[1, 2, 3], 0.7, axis]),
            ).toThrow();
          }
          for (const invalid of [
            [],
            Array(8).fill(1),
            Array(10).fill(1),
            [
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ],
            null,
          ]) {
            expect(() =>
              Reflect.apply(raw.vtmv, raw, [[1, 2, 3], invalid, [4, 5, 6]]),
            ).toThrow();
          }
          for (let component = 0; component < 9; component++)
            for (const invalid of [Infinity, NaN, "2", undefined]) {
              const m: unknown[] = [...matrixValues];
              m[component] = invalid;
              expect(() =>
                Reflect.apply(raw.vtmv, raw, [[1, 2, 3], m, [4, 5, 6]]),
              ).toThrow();
            }
          expect(raw.vtmv([1, -2, 4], matrix, [5, 7, -11])).toBe(-716);
          expect(raw.failed()).toBe(false);
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: distinguishes coefficient order, projections, rotation direction and matrix layout`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          expect(raw.vlcom(2, [1, -2, 4], -3, [5, 7, -11])).toEqual([
            -13, -25, 41,
          ]);
          expect(
            raw.vlcom3(2, [1, -2, 4], -3, [5, 7, -11], 0.5, [-13, 17, 19]),
          ).toEqual([-19.5, -16.5, 50.5]);
          // Pinned N0067 implementation and live SpiceyPy both return zero here;
          // the vperp header's b=0 -> a prose disagrees with its implementation.
          expect(raw.vperp([1, -2, 4], [0, 0, 0])).toEqual([0, 0, 0]);
          expect(raw.vproj([1, -2, 4], [0, 0, 0])).toEqual([0, 0, 0]);
          expectVectorClose(raw.vproj([3, -4, 12], [-2, 0, 0]), [3, 0, 0]);
          expectVectorClose(raw.vperp([3, -4, 12], [-2, 0, 0]), [0, -4, 12]);
          const projected = raw.vproj([1, -2, 4], [5, 7, -11]);
          const perpendicular = raw.vperp([1, -2, 4], [5, 7, -11]);
          expectVectorClose(raw.vadd(projected, perpendicular), [1, -2, 4]);
          expect(raw.vdot(perpendicular, [5, 7, -11])).toBeCloseTo(0, 12);
          expect(raw.vrel([0, 0, 0], [0, 0, 0])).toBe(0);
          expect(raw.vrel([0, 0, 0], [3, -4, 12])).toBe(1);
          expect(raw.vrel([1, 2, 4], [-1, -2, -4])).toBeCloseTo(2, 12);
          expectVectorClose(
            raw.vrotv([1, 0, 0], [0, 0, 1], Math.PI / 2),
            [0, 1, 0],
          );
          expectVectorClose(raw.rotvec([1, 0, 0], Math.PI / 2, 3), [0, -1, 0]);
          for (const axis of [
            0, 4, 5, 6, -1, -2, -3, -4, 2147483647, -2147483648,
          ]) {
            const wrapped = ((axis % 3) + 3) % 3 || 3;
            expect(raw.rotvec([1, -2, 4], 0.7, axis)).toEqual(
              raw.rotvec([1, -2, 4], 0.7, wrapped),
            );
          }
          const rotated = raw.vrotv([1, -2, 4], [2, -3, 5], 0.7);
          expectVectorClose(raw.vrotv(rotated, [2, -3, 5], -0.7), [1, -2, 4]);
          expect(raw.vtmv([1, -2, 4], matrix, [5, 7, -11])).toBe(-716);
          expect(raw.vtmv([5, 7, -11], matrix, [1, -2, 4])).toBe(-1110);
          expect(raw.vtmv([1, 0, 0], matrix, [0, 1, 0])).toBe(-3);
          expect(raw.vtmv([0, 1, 0], matrix, [1, 0, 0])).toBe(7);
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: preserves exact forwarded components and independent outputs after heap reuse`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const source: [number, number, number] = [
            -0,
            Number.MIN_VALUE,
            Number.MAX_VALUE,
          ];
          const unchanged = raw.vrotv(source, [0, 0, 0], 7.25);
          expect(unchanged).not.toBe(source);
          expect(unchanged).toEqual(source);
          expect(Object.is(unchanged[0], -0)).toBe(true);
          const alongAxis = raw.rotvec([-0, 2, 3], 0.7, 1);
          expect(Object.is(alongAxis[0], -0)).toBe(true);
          expect(raw.rotvec([Number.MAX_VALUE, 2, 3], 0.7, 1)[0]).toBe(
            Number.MAX_VALUE,
          );
          const vector: [number, number, number] = [1, -2, 4];
          const results = {
            combined: raw.vlcom(2, vector, -3, [5, 7, -11]),
            combined3: raw.vlcom3(
              2,
              vector,
              -3,
              [5, 7, -11],
              0.5,
              [-13, 17, 19],
            ),
            projected: raw.vproj(vector, [5, 7, -11]),
            perpendicular: raw.vperp(vector, [5, 7, -11]),
            rotated: raw.vrotv(vector, [2, -3, 5], 0.7),
            coordinates: raw.rotvec(vector, 0.7, 3),
          };
          for (const result of Object.values(results))
            expect(result).not.toBe(vector);
          const snapshot = structuredClone({ unchanged, alongAxis, results });
          source[1] = 42;
          vector[0] = 17;
          for (let i = 1; i <= 8; i++)
            for (const call of boundaryCalls)
              Reflect.apply(raw[call.name], raw, call.args);
          expect({ unchanged, alongAxis, results }).toEqual(snapshot);
          results.combined[0] = 99;
          expect(vector[0]).toBe(17);
          expect(results.combined3).toEqual(snapshot.results.combined3);
          expect(unchanged[1]).toBe(Number.MIN_VALUE);
        } finally {
          await dispose();
        }
      },
    );
  }
});
