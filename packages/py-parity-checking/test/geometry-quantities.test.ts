import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients, type SpiceSync } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

type V = readonly [number, number, number];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function unit(a: V): V {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
}
const poleFile = "audit-seasonal-pole.tpc";
function furnish(raw: SpiceSync["raw"], name: string) {
  raw.furnsh({
    path: name,
    bytes: fs.readFileSync(
      new URL(`../fixtures/kernels/${name}`, import.meta.url),
    ),
  });
}
function checkStatus(call: () => unknown, short: string, trace: RegExp) {
  let result: unknown;
  try {
    call();
  } catch (error) {
    result = error;
  }
  expect(result).toMatchObject({
    spiceShort: `SPICE(${short})`,
    spiceLong: expect.any(String),
    spiceTrace: expect.stringMatching(trace),
  });
}
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  async function withFixture(check: (raw: SpiceSync["raw"]) => void) {
    const client = await spiceClients.toSync({ backend });
    const raw = client.spice.raw;
    try {
      raw.kclear();
      for (const f of ["audit-geometry.bsp", "audit-geometry.tf", poleFile])
        furnish(raw, f);
      check(raw);
    } finally {
      try {
        raw.kclear();
      } finally {
        await client.dispose();
      }
    }
  }
  run(
    `${backend}: phase follows the two target-centered sightlines and reception correction`,
    async () => {
      await withFixture((raw) => {
        for (const t of [-3000, 0, 3500]) {
          const sun: V = [100 + 0.001 * t, 50 + 0.002 * t, 20 - 0.001 * t],
            observer: V = [10 + 0.01 * t, 4 - 0.002 * t, 3 + 0.003 * t];
          const angle = Math.atan2(
            Math.hypot(...cross(sun, observer)),
            dot(sun, observer),
          );
          expect(
            Math.abs(raw.phaseq(t, "100101", "SUN", "100102", "NONE") - angle),
          ).toBeLessThan(2e-13);
        }
        expect(raw.phaseq(0, "100101", "100103", "100105", "NONE")).toBe(0);
        expect(raw.phaseq(0, "100101", "100104", "100105", "NONE")).toBe(
          Math.PI,
        );
        const geometric = raw.phaseq(0, "100101", "SUN", "100102", "NONE");
        const reception = raw.phaseq(0, "100101", "SUN", "100102", "LT");
        expect((geometric - reception) * 1e9).toBeCloseTo(6.807761, 5);
        checkStatus(
          () => raw.phaseq(0, "BAD E16 TARGET", "SUN", "100102", "NONE"),
          "IDCODENOTFOUND",
          /phaseq_c.*PHASEQ/i,
        );
        expect(raw.failed()).toBe(false);
        expect(raw.phaseq(0, "100101", "SUN", "100102", "NONE")).toBe(
          geometric,
        );
      });
    },
  );
  run(
    `${backend}: solar longitude uses the instantaneous orbit normal and projected north pole`,
    async () => {
      await withFixture((raw) => {
        const ra = (37 * Math.PI) / 180,
          dec = (53 * Math.PI) / 180;
        const pole: V = [
          Math.cos(dec) * Math.cos(ra),
          Math.cos(dec) * Math.sin(ra),
          Math.sin(dec),
        ];
        const v: V = [0.001, 0.002, -0.001];
        for (const t of [-8000, 0, 3500, 8000]) {
          const sun: V = [100 + v[0] * t, 50 + v[1] * t, 20 + v[2] * t];
          const z = unit(cross(sun, v)),
            x = unit(cross(pole, z)),
            y = cross(z, x);
          const expected =
            (Math.atan2(dot(sun, y), dot(sun, x)) + 2 * Math.PI) %
            (2 * Math.PI);
          expect(
            Math.abs(raw.lspcn("100101", t, "NONE") - expected),
          ).toBeLessThan(2e-13);
        }
        const original = raw.lspcn("100101", 0, "NONE");
        raw.pdpool("BODY100101_PM", [162, -27, 0]);
        expect(raw.lspcn("100101", 0, "NONE")).toBeCloseTo(original, 13);
        raw.kclear();
        furnish(raw, "audit-geometry.bsp");
        checkStatus(
          () => raw.lspcn("100101", 0, "NONE"),
          "FRAMEDATANOTFOUND",
          /LSPCN.*TIPBOD/i,
        );
        expect(raw.failed()).toBe(false);
        furnish(raw, poleFile);
        expect(raw.lspcn("100101", 0, "NONE")).toBe(original);
      });
    },
  );
  run(
    `${backend}: signed limb separation crosses contact and uses the largest triaxial radius`,
    async () => {
      await withFixture((raw) => {
        const separation = (t: number, shape: string, frame: string) =>
          raw.trgsep(
            t,
            "100101",
            shape,
            frame,
            "100103",
            "POINT",
            "other frame",
            "100104",
            "NONE",
          );
        const angularRadius = Math.asin(3 / 20);
        const contact = (40 * Math.tan(angularRadius)) / 0.1;
        for (const offset of [-0.001, 0, 0.001, 60]) {
          const t = contact + offset,
            point = Math.atan2(0.1 * t, 40);
          expect(
            Math.abs(separation(t, "POINT", "J2000") - point),
          ).toBeLessThan(2e-13);
          const actual = separation(t, "SPHERE", "未定義");
          expect(Math.abs(actual - (point - angularRadius))).toBeLessThan(
            2e-13,
          );
          if (offset) expect(Math.sign(actual)).toBe(Math.sign(offset));
        }
        raw.pdpool("BODY100101_RADII", [1, 3, 2]);
        expect(separation(0, "SPHERE", "unused")).toBeCloseTo(
          -angularRadius,
          13,
        );
        checkStatus(
          () => separation(0, "SPHERE", ""),
          "EMPTYSTRING",
          /trgsep_c/i,
        );
        expect(raw.failed()).toBe(false);
        expect(separation(0, "POINT", "unused")).toBe(0);
      });
    },
  );
  run(
    `${backend}: rejected representations and checked metadata guards release the client for a valid subsequent query`,
    async () => {
      await withFixture((raw) => {
        expect(() =>
          raw.phaseq(Infinity, "100101", "SUN", "100102", "NONE"),
        ).toThrow(/finite/i);
        expect(() => raw.lspcn("100101", 0, "NE\0VER")).toThrow(/NUL/i);
        expect(() =>
          raw.trgsep(
            0,
            "100101",
            "POINT",
            "\uD800",
            "100103",
            "POINT",
            "f",
            "100104",
            "NONE",
          ),
        ).toThrow(/surrogate/i);
        for (const call of [
          () => raw.lspcn("-2147483648", 0, "NONE"),
          () => raw.phaseq(0, "100101", "-2147483648", "100102", "NONE"),
          () =>
            raw.trgsep(
              0,
              "100101",
              "POINT",
              "f",
              "100103",
              "POINT",
              "f",
              "-2147483648",
              "NONE",
            ),
        ])
          expect(call).toThrow(/hash/i);
        // These guards run before the body hash or the PCK degree conversion.
        raw.pcpool("NAIF_BODY_NAME", ["E16 MAPPED BODY"]);
        raw.pdpool("NAIF_BODY_CODE", [-2147483647.5]);
        expect(() => raw.lspcn("100101", 0, "NONE")).toThrow(/hash/i);
        raw.pdpool("NAIF_BODY_CODE", [100101]);
        raw.pdpool("BODY100101_NUT_PREC_ANGLES", [0, 0]);
        raw.pdpool("BODY100101_MAX_PHASE_DEGREE", [2147483648]);
        expect(() => raw.lspcn("E16 MAPPED BODY", 0, "NONE")).toThrow(
          /phase degree/i,
        );
        raw.kclear();
        furnish(raw, "audit-geometry.bsp");
        furnish(raw, poleFile);
        expect(raw.failed()).toBe(false);
        expect(raw.lspcn("100101", 0, "NONE")).toBeCloseTo(
          2.071875507862086,
          12,
        );
      });
    },
  );
}
