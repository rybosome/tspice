import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { ParityCase } from "../src/case-types.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const constants = [
  { name: "pi", op: "coords-vectors.pi" },
  { name: "twopi", op: "coords-vectors.twopi" },
  { name: "halfpi", op: "coords-vectors.halfpi" },
  { name: "dpr", op: "coords-vectors.dpr" },
  { name: "rpd", op: "coords-vectors.rpd" },
  { name: "spd", op: "time.spd" },
  { name: "j2000", op: "time.j2000" },
  { name: "j1900", op: "time.j1900" },
  { name: "b1950", op: "time.b1950" },
] as const;

const oracleCase: ParityCase = {
  caseId: "constants-exact-live-values",
  description: "Compare all nine constants without numerical normalization.",
  workflow: constants.map(({ op }) => ({ op })),
  expectation: { kind: "success" },
};
const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");

describe("raw kernel-free constants", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;

    testBackend(
      `${backend}: preserves the complete scalar returned by live SpiceyPy`,
      async () => {
        const oracle = await runCaseInSidecar(oracleCase, fixturesRoot);
        expect(oracle.ok).toBe(true);
        if (!oracle.ok) throw new Error(oracle.error.message);
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          spice.raw.kclear();
          const actual = constants.map(({ name, op }) => ({
            op,
            value: spice.raw[name](),
          }));
          // These fixed N0067 constants need no conditioning tolerance. Exact
          // live comparison also detects loss of fractional Julian-day bits,
          // which the normal relative tolerance at JD magnitude can hide.
          expect(actual).toEqual(oracle.outputs);
          expect(actual.every(({ value }) => Number.isFinite(value))).toBe(
            true,
          );
          expect(spice.raw.ktotal("ALL")).toBe(0);
          expect(spice.raw.failed()).toBe(false);
        } finally {
          try {
            spice.raw.kclear();
          } finally {
            await dispose();
          }
        }
      },
      20_000,
    );

    testBackend(
      `${backend}: keeps units and repeatability across pool and time-default changes`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const calendar = raw.timdef("GET", "CALENDAR");
          const system = raw.timdef("GET", "SYSTEM");
          const zone = raw.timdef("GET", "ZONE");
          try {
            raw.kclear();
            const before = constants.map(({ name }) => raw[name]());
            raw.pdpool("TSPICE_CONSTANT_SENTINEL", [17, -4.5]);
            raw.timdef("SET", "CALENDAR", "JULIAN");
            raw.timdef("SET", "SYSTEM", "TDT");
            expect(constants.map(({ name }) => raw[name]())).toEqual(before);
            expect(raw.gdpool("TSPICE_CONSTANT_SENTINEL", 0, 2)).toEqual({
              found: true,
              values: [17, -4.5],
            });
            expect(raw.timdef("GET", "CALENDAR")).toBe("JULIAN");
            expect(raw.timdef("GET", "SYSTEM")).toBe("TDT");
            raw.kclear();
            raw.reset();
            expect(constants.map(({ name }) => raw[name]())).toEqual(before);
            expect(raw.failed()).toBe(false);

            // Independent unit identities supplement the live oracle comparison.
            expect(raw.twopi()).toBe(2 * raw.pi());
            expect(raw.halfpi()).toBe(raw.pi() / 2);
            expect(raw.dpr() * raw.rpd()).toBeCloseTo(1, 15);
            expect(raw.pi() * raw.dpr()).toBeCloseTo(180, 12);
            expect(180 * raw.rpd()).toBeCloseTo(raw.pi(), 14);
            expect(raw.spd()).toBe(24 * 60 * 60);
            expect(raw.j2000()).toBe(2451545);
            expect(raw.j1900()).toBe(2415020);
            expect(raw.j2000() - raw.j1900()).toBe(36525);
            // B1950 is a Julian date, with the full Lieske fractional day.
            expect(raw.b1950()).toBe(2433282.42345905);
            expect(raw.b1950() % 1).toBeGreaterThan(0.4234);
          } finally {
            raw.timdef("SET", "CALENDAR", calendar);
            if (system) raw.timdef("SET", "SYSTEM", system);
            else if (zone) raw.timdef("SET", "ZONE", zone);
          }
        } finally {
          try {
            raw.kclear();
          } finally {
            await dispose();
          }
        }
      },
    );
  }
});
