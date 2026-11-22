import type { Spice, SpiceAsync } from "@rybosome/tspice";

import { spiceClients } from "@rybosome/tspice";

// This fixture exists to ensure @rybosome/tspice's emitted .d.ts doesn't
// accidentally pull in DOM types. This should typecheck with `lib: ["ES2022"]`.
void spiceClients;

/** Check synchronous/asynchronous raw constants without browser library types. */
export function constantTypes(sync: Spice, async: SpiceAsync): void {
  const scalar: number = sync.raw.pi();
  const julianDate: number = sync.raw.j2000();
  const promisedScalar: Promise<number> = async.raw.rpd();
  const promisedJulianDate: Promise<number> = async.raw.b1950();
  void [scalar, julianDate, promisedScalar, promisedJulianDate];
}

/** Check scalar raw API types without browser library declarations. */
export function scalarConstantTypes(sync: Spice, async: SpiceAsync): void {
  const secondsPerYear: number = sync.raw.jyear();
  const minimumInteger: number = sync.raw.intmin();
  const promisedLimit: Promise<number> = async.raw.dpmax();
  const promisedDate: Promise<number> = async.raw.b1900();
  void [secondsPerYear, minimumInteger, promisedLimit, promisedDate];
}

/** Check public coordinate conversion types without browser declarations. */
export function cylindricalTypes(sync: Spice, async: SpiceAsync): void {
  const rect: [number, number, number] = sync.raw.cylrec(3, 0.5, -2);
  const cyl: { radius: number; lon: number; z: number } = sync.raw.reccyl(rect);
  const lat: Promise<{ radius: number; lon: number; lat: number }> =
    async.raw.cyllat(3, 0.5, -2);
  const sph: Promise<{ radius: number; colat: number; lon: number }> =
    async.raw.latsph(3, 0.5, -0.2);
  void [cyl, lat, sph];
}

/** Verify basic vector APIs accept readonly inputs without requiring DOM types. */
export function vectorBasicsTypes(sync: Spice, async: SpiceAsync): void {
  const input = [1, -2, 3] as const;
  const copy: [number, number, number] = sync.raw.vequ(input);
  const unpacked: { x: number; y: number; z: number } = sync.raw.vupack(input);
  const zero: boolean = sync.raw.vzero(input);
  const norm: Promise<{ unit: [number, number, number]; norm: number }> =
    async.raw.unorm(input);
  const separation: Promise<number> = async.raw.vsep(input, input);
  void [copy, unpacked, zero, norm, separation];
}
