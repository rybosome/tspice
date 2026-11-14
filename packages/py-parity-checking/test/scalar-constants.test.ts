import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { ParityCase } from "../src/case-types.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const constants = [
  { name: "b1900", op: "time.b1900" },
  { name: "j1950", op: "time.j1950" },
  { name: "j2100", op: "time.j2100" },
  { name: "jyear", op: "time.jyear" },
  { name: "tyear", op: "time.tyear" },
  { name: "clight", op: "coords-vectors.clight" },
  { name: "dpmax", op: "coords-vectors.dpmax" },
  { name: "dpmin", op: "coords-vectors.dpmin" },
  { name: "intmax", op: "coords-vectors.intmax" },
  { name: "intmin", op: "coords-vectors.intmin" },
] as const;

const oracleCase: ParityCase = {
  caseId: "scalar-constants-exact-live-values",
  description: "Compare all ten constants without numerical normalization.",
  workflow: constants.map(({ op }) => ({ op })),
  expectation: { kind: "success" },
};
const fixturesRoot = path.resolve(import.meta.dirname, "../fixtures");

describe("raw scalar and machine constants", () => {
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
          // live comparison detects fractional Julian-day loss and adjacent
          // representable values near DBL_MAX that relative tolerance allows.
          // The sidecar's real JSON response must also retain finite extrema.
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

            // Units and supported IEEE binary64/signed32 ABI boundaries are
            // independently observable, in addition to the live oracle values.
            expect(raw.clight()).toBe(299792.458);
            expect(raw.jyear()).toBe(365.25 * 86400);
            expect(raw.tyear()).toBe(31556925.9747);
            expect(raw.tyear()).toBeLessThan(raw.jyear());
            expect(raw.b1900()).toBe(2415020.31352);
            expect(raw.j1950()).toBe(2433282.5);
            expect(raw.j2100()).toBe(2488070);
            expect(raw.j2100() - raw.j1950()).toBe(150 * 365.25);
            expect(raw.dpmax()).toBe(Number.MAX_VALUE);
            // dpmin is the most negative finite value, not the smallest positive
            // subnormal represented by JavaScript's Number.MIN_VALUE.
            expect(raw.dpmin()).toBe(-Number.MAX_VALUE);
            expect(raw.intmax()).toBe(2147483647);
            expect(raw.intmin()).toBe(-2147483648);
            expect(raw.intmax() + raw.intmin()).toBe(-1);
            expect(Number.isSafeInteger(raw.intmax())).toBe(true);
            expect(Number.isSafeInteger(raw.intmin())).toBe(true);
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
