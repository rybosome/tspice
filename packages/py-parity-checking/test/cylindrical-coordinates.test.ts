import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const scalarMethods = [
  "cyllat",
  "cylrec",
  "cylsph",
  "latcyl",
  "latsph",
  "sphcyl",
  "sphlat",
] as const;

function expectVectorClose(
  actual: readonly number[],
  expected: readonly number[],
) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++)
    expect(actual[i]).toBeCloseTo(expected[i]!, 12);
}

describe("raw cylindrical coordinate boundaries and ownership", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: rejects malformed JS inputs before compiled conversion and recovers`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          for (const method of scalarMethods) {
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
                const args: unknown[] = [2.5, 0.4, -0.7];
                args[position] = value;
                expect(() => Reflect.apply(raw[method], raw, args)).toThrow();
              }
            }
            expect(() => raw[method](2.5, 0.4, -0.7)).not.toThrow();
          }
          for (const vector of [
            [],
            [1, 2],
            [1, 2, 3, 4],
            [1, 2, NaN],
            [Infinity, 2, 3],
            [1, -Infinity, 3],
            [1, 2, "3"],
            [1, undefined, 3],
            null,
          ])
            expect(() => Reflect.apply(raw.reccyl, raw, [vector])).toThrow();
          const recovered = raw.reccyl(Object.freeze([3, 4, -2] as const));
          expect(recovered.radius).toBe(5);
          expect(recovered.z).toBe(-2);
          expect(recovered.lon).toBeCloseTo(Math.atan2(4, 3), 12);
          expect(raw.failed()).toBe(false);
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: preserves documented longitude, origin and signed-radius behavior`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const fourthQuadrant = raw.reccyl([3, -4, 7]);
          expect(fourthQuadrant.radius).toBe(5);
          expect(fourthQuadrant.z).toBe(7);
          expect(fourthQuadrant.lon).toBeCloseTo(
            Math.atan2(-4, 3) + 2 * Math.PI,
            12,
          );
          expect(raw.reccyl([0, 0, -7])).toEqual({ radius: 0, lon: 0, z: -7 });
          expect(raw.cyllat(0, 19.25, 0)).toEqual({
            radius: 0,
            lon: 19.25,
            lat: 0,
          });
          expect(raw.cylsph(0, -19.25, 0)).toEqual({
            radius: 0,
            colat: 0,
            lon: -19.25,
          });
          const negativeLat = raw.cyllat(-3, -19.25, 4);
          expect(negativeLat.radius).toBe(5);
          expect(negativeLat.lon).toBe(-19.25);
          expect(negativeLat.lat).toBeCloseTo(Math.atan2(4, -3), 12);
          const negativeSph = raw.cylsph(-3, 19.25, -4);
          expect(negativeSph.radius).toBe(5);
          expect(negativeSph.lon).toBe(19.25);
          expect(negativeSph.colat).toBeCloseTo(Math.atan2(-3, -4), 12);
          expect(raw.latsph(-5, 19.25, 2.2)).toEqual({
            radius: -5,
            colat: Math.PI / 2 - 2.2,
            lon: 19.25,
          });
          expect(raw.sphlat(-5, 4.5, -19.25)).toEqual({
            radius: -5,
            lon: -19.25,
            lat: Math.PI / 2 - 4.5,
          });
          expect(raw.latcyl(5, 19.25, Math.PI).radius).toBe(-5);
          expect(raw.sphcyl(5, -Math.PI / 2, -19.25).radius).toBe(-5);
          expectVectorClose(raw.cylrec(-3, 0, -4), [-3, 0, -4]);
          // Scale the actual tiny/huge outputs before asserting: the standard
          // absolute parity tolerance alone cannot distinguish 5e-200 from zero.
          for (const scale of [1e-200, 1e200]) {
            expect(
              raw.cyllat(3 * scale, 1.2, -4 * scale).radius / scale,
            ).toBeCloseTo(5, 14);
            expect(
              raw.cylsph(3 * scale, 1.2, -4 * scale).radius / scale,
            ).toBeCloseTo(5, 14);
            expect(
              raw.reccyl([3 * scale, -4 * scale, 2 * scale]).radius / scale,
            ).toBeCloseTo(5, 14);
            expectVectorClose(
              raw
                .cylrec(3 * scale, 0.7, -4 * scale)
                .map((value) => value / scale),
              [3 * Math.cos(0.7), 3 * Math.sin(0.7), -4],
            );
            const cylindricalLat = raw.latcyl(5 * scale, -0.7, 0.4);
            expectVectorClose(
              [cylindricalLat.radius / scale, cylindricalLat.z / scale],
              [5 * Math.cos(0.4), 5 * Math.sin(0.4)],
            );
            const cylindricalSph = raw.sphcyl(5 * scale, 0.4, -0.7);
            expectVectorClose(
              [cylindricalSph.radius / scale, cylindricalSph.z / scale],
              [5 * Math.sin(0.4), 5 * Math.cos(0.4)],
            );
            expect(raw.latsph(-5 * scale, 7.5, 0.4).radius).toBe(-5 * scale);
            expect(raw.sphlat(-5 * scale, 0.4, 7.5).radius).toBe(-5 * scale);
          }
        } finally {
          await dispose();
        }
      },
    );

    testBackend(
      `${backend}: composes all conversions and retains copied outputs after later calls`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const rect = Object.freeze([-3.5, 4.25, -2.75] as const);
          const cylindrical = raw.reccyl(rect);
          const latitude = raw.cyllat(
            cylindrical.radius,
            cylindrical.lon,
            cylindrical.z,
          );
          const spherical = raw.cylsph(
            cylindrical.radius,
            cylindrical.lon,
            cylindrical.z,
          );
          const restored = raw.cylrec(
            cylindrical.radius,
            cylindrical.lon,
            cylindrical.z,
          );
          expectVectorClose(restored, rect);
          const fromLat = raw.latcyl(
            latitude.radius,
            latitude.lon,
            latitude.lat,
          );
          const fromSph = raw.sphcyl(
            spherical.radius,
            spherical.colat,
            spherical.lon,
          );
          expectVectorClose(
            [fromLat.radius, fromLat.lon, fromLat.z],
            [cylindrical.radius, cylindrical.lon, cylindrical.z],
          );
          expectVectorClose(
            [fromSph.radius, fromSph.lon, fromSph.z],
            [cylindrical.radius, cylindrical.lon, cylindrical.z],
          );
          const latToSph = raw.latsph(
            latitude.radius,
            latitude.lon,
            latitude.lat,
          );
          const sphToLat = raw.sphlat(
            spherical.radius,
            spherical.colat,
            spherical.lon,
          );
          expectVectorClose(
            [latToSph.radius, latToSph.colat, latToSph.lon],
            [spherical.radius, spherical.colat, spherical.lon],
          );
          expectVectorClose(
            [sphToLat.radius, sphToLat.lon, sphToLat.lat],
            [latitude.radius, latitude.lon, latitude.lat],
          );
          const retained = structuredClone({
            cylindrical,
            latitude,
            spherical,
            restored,
            fromLat,
            fromSph,
            latToSph,
            sphToLat,
          });
          for (let i = 1; i <= 8; i++) {
            raw.reccyl([i, -2 * i, 3 * i]);
            for (const method of scalarMethods)
              raw[method](i, -0.3 * i, 0.7 * i);
          }
          expect({
            cylindrical,
            latitude,
            spherical,
            restored,
            fromLat,
            fromSph,
            latToSph,
            sphToLat,
          }).toEqual(retained);
          expect(rect).toEqual([-3.5, 4.25, -2.75]);
        } finally {
          await dispose();
        }
      },
    );
  }
});
