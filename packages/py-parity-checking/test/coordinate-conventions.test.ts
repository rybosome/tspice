import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { Spice } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import type { StepOutput } from "../src/case-types.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixtureBytes = fs.readFileSync(
  new URL("../fixtures/kernels/coordinate-conventions.tpc", import.meta.url),
);
const loadFixture = (raw: Spice["raw"]) =>
  raw.furnsh({ path: "coordinate-conventions.tpc", bytes: fixtureBytes });
function expectComponents(
  actual: readonly number[],
  expected: readonly number[],
) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++)
    expect(actual[i]).toBeCloseTo(expected[i]!, 12);
}
function scaledComponents(output: StepOutput, scale: number): number[] {
  switch (output.op) {
    case "coords-vectors.azlrec":
    case "coords-vectors.radrec":
    case "coords-vectors.pgrrec":
    case "coords-vectors.srfrec":
      return output.value.map((value) => value * scale);
    case "coords-vectors.recazl":
      return [output.value.range * scale, output.value.az, output.value.el];
    case "coords-vectors.recrad":
      return [output.value.range * scale, output.value.ra, output.value.dec];
    case "coords-vectors.recpgr":
      return [output.value.lon, output.value.lat, output.value.alt * scale];
    default:
      throw new Error("Unexpected coordinate observation");
  }
}
const calls: {
  name: keyof Pick<
    Spice["raw"],
    "azlrec" | "recazl" | "pgrrec" | "recpgr" | "radrec" | "recrad" | "srfrec"
  >;
  args: readonly unknown[];
  scalarSlots: readonly number[];
  vectorSlots?: readonly number[];
  booleanSlots?: readonly number[];
  bodyStringSlot?: number;
}[] = [
  {
    name: "azlrec",
    args: [5, 0.7, -0.4, true, false],
    scalarSlots: [0, 1, 2],
    booleanSlots: [3, 4],
  },
  {
    name: "recazl",
    args: [[3, 4, -12], true, false],
    scalarSlots: [],
    vectorSlots: [0],
    booleanSlots: [1, 2],
  },
  {
    name: "pgrrec",
    args: ["EARTH", 0.7, -0.4, 1, 3, 0.2],
    scalarSlots: [1, 2, 3, 4, 5],
    bodyStringSlot: 0,
  },
  {
    name: "recpgr",
    args: ["EARTH", [3, 4, -2], 3, 0.2],
    scalarSlots: [2, 3],
    vectorSlots: [1],
    bodyStringSlot: 0,
  },
  { name: "radrec", args: [5, 0.7, -0.4], scalarSlots: [0, 1, 2] },
  { name: "recrad", args: [[3, 4, -12]], scalarSlots: [], vectorSlots: [0] },
  { name: "srfrec", args: [9901001, 0.7, -0.4], scalarSlots: [1, 2] },
];

describe("raw coordinate conventions", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: compares every scaled component and tiny RA against the actual live oracle`,
      async () => {
        const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const name of [
            "azlrec",
            "recazl",
            "radrec",
            "recrad",
            "pgrrec",
            "recpgr",
            "srfrec",
          ]) {
            const id = `coords-vectors-${name}-${name === "srfrec" ? "scaled-radii" : "scaled-magnitudes"}`;
            const c = allCases.find((entry) => entry.caseId === id);
            if (!c) throw new Error(`Missing scaled case ${id}`);
            const oracle = await runCaseInSidecar(c, fixturesRoot),
              actual = runCaseInTspice(spice, c, fixturesRoot);
            if (!oracle.ok) throw new Error(oracle.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            const expected = oracle.outputs.filter(
                (output) => output.op === `coords-vectors.${name}`,
              ),
              observed = actual.outputs.filter(
                (output) => output.op === `coords-vectors.${name}`,
              );
            expect(expected).toHaveLength(2);
            expect(observed).toHaveLength(2);
            const magnitude =
              name === "pgrrec" || name === "recpgr" || name === "srfrec"
                ? 1e100
                : 1e200;
            for (let i = 0; i < 2; i++) {
              const scale = i === 0 ? 1 / magnitude : magnitude;
              expectComponents(
                scaledComponents(observed[i]!, scale),
                scaledComponents(expected[i]!, scale),
              );
            }
          }
          const c = allCases.find(
            (entry) => entry.caseId === "coords-vectors-recrad-near-axis",
          );
          if (!c) throw new Error("Missing small positive RA case");
          const oracle = await runCaseInSidecar(c, fixturesRoot),
            actual = runCaseInTspice(spice, c, fixturesRoot);
          if (!oracle.ok) throw new Error(oracle.error.message);
          if (!actual.ok) throw new Error(actual.error.message);
          const left = actual.outputs[0],
            right = oracle.outputs[0];
          if (left?.op !== "coords-vectors.recrad" || right?.op !== left.op)
            throw new Error("Missing RA observation");
          expect(right.value.ra * 1e15).toBeCloseTo(1, 12);
          expect(left.value.ra * 1e15).toBeCloseTo(right.value.ra * 1e15, 12);
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

    testBackend(
      `${backend}: validates all scalar, vector, flag, body and integer slots`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          raw.kclear();
          loadFixture(raw);
          const vectors: unknown[] = [null, [], [1, 2], [1, 2, 3, 4]];
          for (let i = 0; i < 3; i++)
            for (const invalid of [NaN, Infinity, -Infinity, "1", undefined]) {
              const vector: unknown[] = [1, 2, 3];
              vector[i] = invalid;
              vectors.push(vector);
            }
          for (const call of calls) {
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
                expect(() =>
                  Reflect.apply(raw[call.name], raw, args),
                ).toThrow();
              }
            for (const slot of call.vectorSlots ?? [])
              for (const vector of vectors) {
                const args = [...call.args];
                args[slot] = vector;
                expect(() =>
                  Reflect.apply(raw[call.name], raw, args),
                ).toThrow();
              }
            for (const slot of call.booleanSlots ?? [])
              for (const invalid of [0, 1, "true", null, undefined, NaN]) {
                const args = [...call.args];
                args[slot] = invalid;
                expect(() =>
                  Reflect.apply(raw[call.name], raw, args),
                ).toThrow();
              }
            if (call.bodyStringSlot !== undefined)
              for (const invalid of [
                null,
                399,
                true,
                undefined,
                "EARTH\0MARS",
              ]) {
                const args = [...call.args];
                args[call.bodyStringSlot] = invalid;
                expect(() =>
                  Reflect.apply(raw[call.name], raw, args),
                ).toThrow();
              }
            expect(() =>
              Reflect.apply(raw[call.name], raw, call.args),
            ).not.toThrow();
          }
          for (const body of [
            0.5,
            2147483648,
            -2147483649,
            NaN,
            Infinity,
            "9901001",
            null,
            undefined,
          ])
            expect(() =>
              Reflect.apply(raw.srfrec, raw, [body, 0.7, -0.4]),
            ).toThrow();
          for (const body of [-2147483648, 2147483647]) {
            raw.pdpool(`BODY${body}_RADII`, [3, 2, 1]);
            expectComponents(raw.srfrec(body, 0, 0), [3, 0, 0]);
          }
          expect(raw.failed()).toBe(false);
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
      `${backend}: preserves all direction flags, RA quadrants, zero and negative-range conventions`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          for (const azccw of [true, false])
            for (const elplsz of [true, false]) {
              expectComponents(
                raw.azlrec(8, Math.PI / 6, Math.PI / 6, azccw, elplsz),
                [6, (azccw ? 1 : -1) * 2 * Math.sqrt(3), (elplsz ? 1 : -1) * 4],
              );
              const out = raw.recazl([3, 4, -12], azccw, elplsz);
              expect(out.range).toBeCloseTo(13, 12);
              expect(out.az).toBeCloseTo(
                azccw ? Math.atan2(4, 3) : 2 * Math.PI - Math.atan2(4, 3),
                12,
              );
              expect(out.el).toBeCloseTo(
                (elplsz ? -1 : 1) * Math.atan2(12, 5),
                12,
              );
              expectComponents(
                raw.azlrec(out.range, out.az, out.el, azccw, elplsz),
                [3, 4, -12],
              );
              expect(raw.recazl([0, 0, 0], azccw, elplsz)).toEqual({
                range: 0,
                az: 0,
                el: 0,
              });
              expect(raw.recazl([0, 0, -5], azccw, elplsz).az).toBe(0);
            }
          const quadrants = [
            [1, 1, 0],
            [-1, 1, 0],
            [-1, -1, 0],
            [1, -1, 0],
          ] as const;
          for (let i = 0; i < quadrants.length; i++) {
            const out = raw.recrad(quadrants[i]!);
            expect(out.ra).toBeCloseTo(((2 * i + 1) * Math.PI) / 4, 12);
            expect(out.dec).toBe(0);
            expectComponents(
              raw.radrec(out.range, out.ra, out.dec),
              quadrants[i]!,
            );
          }
          expect(raw.recrad([0, 0, 0])).toEqual({ range: 0, ra: 0, dec: 0 });
          expect(raw.recrad([0, 0, -5]).ra).toBe(0);
          expect(raw.recrad([0, 0, -5]).dec).toBeCloseTo(-Math.PI / 2, 12);
          expectComponents(
            raw.radrec(-5, 0.7, -0.4),
            raw.radrec(5, 0.7, -0.4).map((value) => -value),
          );
          expectComponents(
            raw.azlrec(-5, 0.7, -0.4, false, true),
            raw.azlrec(5, 0.7, -0.4, false, true).map((value) => -value),
          );
          expectComponents(
            raw.radrec(5, 2 * Math.PI + 0.7, -0.4),
            raw.radrec(5, 0.7, -0.4),
          );
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: observes body spin conventions, overrides and planetocentric surface latitude`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          raw.kclear();
          loadFixture(raw);
          const west = raw.pgrrec(
            "TSPICE_COORD_PROGRADE",
            0.7,
            -0.4,
            1,
            3,
            0.2,
          );
          const east = raw.pgrrec(
            "TSPICE_COORD_RETROGRADE",
            0.7,
            -0.4,
            1,
            3,
            0.2,
          );
          expectComponents(west, [east[0], -east[1], east[2]]);
          expect(west[1]).toBeLessThan(0);
          expect(east[1]).toBeGreaterThan(0);
          expect(raw.pgrrec("9901001", 0.7, -0.4, 1, 3, 0.2)).toEqual(west);
          for (const body of ["EARTH", "MOON", "SUN", "9901003"])
            expectComponents(raw.pgrrec(body, 0.7, -0.4, 1, 3, 0.2), east);
          const inverse = raw.recpgr("9901001", west, 3, 0.2);
          expectComponents(
            [inverse.lon, inverse.lat, inverse.alt],
            [0.7, -0.4, 1],
          );
          raw.pcpool("BODY9901001_PGR_POSITIVE_LON", [" east "]);
          expectComponents(raw.pgrrec("9901001", 0.7, -0.4, 1, 3, 0.2), east);
          raw.pcpool("BODY399_PGR_POSITIVE_LON", ["WEST"]);
          expectComponents(raw.pgrrec("EARTH", 0.7, -0.4, 1, 3, 0.2), west);
          const surface = raw.srfrec(9901002, 0, Math.PI / 4);
          expectComponents(surface, [4 / Math.sqrt(5), 0, 4 / Math.sqrt(5)]);
          const geodetic = raw.georec(0, Math.PI / 4, 0, 4, 0.5);
          expect(Math.abs(surface[2] - geodetic[2])).toBeGreaterThan(0.5);
          const tri = raw.srfrec(9901001, 0.7, -0.4);
          expect(
            (tri[0] / 3) ** 2 + (tri[1] / 2) ** 2 + tri[2] ** 2,
          ).toBeCloseTo(1, 12);
          raw.pdpool("BODY9901001_RADII", [6, 4, 2]);
          expectComponents(
            raw.srfrec(9901001, 0.7, -0.4),
            tri.map((value) => 2 * value),
          );
          raw.kclear();
          expectComponents(raw.pgrrec("EARTH", 0.7, -0.4, 1, 3, 0.2), east);
          expect(() => raw.pgrrec("9901001", 0.7, -0.4, 1, 3, 0.2)).toThrow(
            /MISSINGDATA/,
          );
          expect(() => raw.srfrec(9901001, 0.7, -0.4)).toThrow(
            /KERNELVARNOTFOUND/,
          );
          loadFixture(raw);
          expectComponents(raw.pgrrec("9901001", 0.7, -0.4, 1, 3, 0.2), west);
          expectComponents(raw.srfrec(9901001, 0.7, -0.4), tri);
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
      `${backend}: recovers from genuine body, shape and radius-pool errors on the same client`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          raw.kclear();
          for (const body of ["MOON", "SUN", "9901001"]) {
            expect(() => raw.pgrrec(body, 0.7, -0.4, 1, 3, 0.2)).toThrow(
              /MISSINGDATA/,
            );
            expect(() => raw.recpgr(body, [3, 4, -2], 3, 0.2)).toThrow(
              /MISSINGDATA/,
            );
          }
          expect(() =>
            raw.pgrrec("TSPICE_UNKNOWN_COORD_BODY", 0.7, -0.4, 1, 3, 0.2),
          ).toThrow(/IDCODENOTFOUND/);
          expect(() => raw.pgrrec("", 0.7, -0.4, 1, 3, 0.2)).toThrow(
            /EMPTYSTRING/,
          );
          for (const [re, f] of [
            [0, 0.2],
            [-1, 0.2],
            [3, 1],
            [3, 2],
          ]) {
            expect(() => raw.pgrrec("EARTH", 0.7, -0.4, 1, re!, f!)).toThrow(
              /VALUEOUTOFRANGE/,
            );
            expect(() => raw.recpgr("EARTH", [3, 4, -2], re!, f!)).toThrow(
              /VALUEOUTOFRANGE/,
            );
          }
          raw.pcpool("BODY399_PGR_POSITIVE_LON", ["NORTH"]);
          expect(() => raw.recpgr("EARTH", [3, 4, -2], 3, 0.2)).toThrow(
            /INVALIDOPTION/,
          );
          raw.pcpool("BODY399_PGR_POSITIVE_LON", ["EAST"]);
          expect(() =>
            raw.recpgr(
              "EARTH",
              [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE],
              3,
              0.2,
            ),
          ).toThrow(/INPUTSTOOLARGE/);
          expect(() => raw.srfrec(9901001, 0.7, -0.4)).toThrow(
            /KERNELVARNOTFOUND/,
          );
          for (const [radii, error] of [
            [[3, 2], "INVALIDCOUNT"],
            [[3, 2, 1, 4], "ARRAYTOOSMALL"],
          ] as const) {
            raw.pdpool("BODY9901001_RADII", [...radii]);
            expect(() => raw.srfrec(9901001, 0.7, -0.4)).toThrow(error);
          }
          for (let axis = 0; axis < 3; axis++)
            for (const bad of [0, -1]) {
              const radii = [3, 2, 1];
              radii[axis] = bad;
              raw.pdpool("BODY9901001_RADII", radii);
              expect(() => raw.srfrec(9901001, 0.7, -0.4)).toThrow(
                /BADAXISLENGTH/,
              );
            }
          raw.pcpool("BODY9901001_RADII", ["x", "y", "z"]);
          expect(() => raw.srfrec(9901001, 0.7, -0.4)).toThrow(/TYPEMISMATCH/);
          raw.pdpool("BODY9901001_RADII", [3, 2, 1]);
          expectComponents(raw.srfrec(9901001, 0, 0), [3, 0, 0]);
          expect(raw.recpgr("EARTH", [3, 0, 0], 3, 0.2).alt).toBe(0);
          expect(raw.failed()).toBe(false);
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
      `${backend}: owns all returned vectors and records through input mutation and heap reuse`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          raw.kclear();
          loadFixture(raw);
          const input: [number, number, number] = [3, 4, -2];
          const results = {
            azl: raw.azlrec(5, 0.7, -0.4, true, false),
            azimuth: raw.recazl(input, true, false),
            pgr: raw.pgrrec("EARTH", 0.7, -0.4, 1, 3, 0.2),
            planetographic: raw.recpgr("EARTH", input, 3, 0.2),
            radial: raw.radrec(5, 0.7, -0.4),
            ascension: raw.recrad(input),
            surface: raw.srfrec(9901001, 0.7, -0.4),
          };
          const snapshot = structuredClone(results);
          input[0] = 99;
          for (let i = 1; i <= 8; i++)
            for (const call of calls)
              Reflect.apply(raw[call.name], raw, call.args);
          expect(results).toEqual(snapshot);
          results.azl[0] = 99;
          expect(results.radial).toEqual(snapshot.radial);
          expect(results.surface).toEqual(snapshot.surface);
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
  }
});
