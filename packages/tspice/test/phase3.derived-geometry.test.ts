import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

import { ensureKernelFile } from "./helpers/kernels.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lskPath = path.join(__dirname, "fixtures", "kernels", "naif0012.tls");

const PCK = {
  name: "pck00010.tpc",
  url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc",
  sha256: "59468328349aa730d18bf1f8d7e86efe6e40b75dfb921908f99321b3a7a701d2",
} as const;

const SPK = {
  name: "de440s.bsp",
  url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp",
  sha256: "c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2",
} as const;

function expectFiniteVec(v: readonly number[]) {
  expect(v).toHaveLength(3);
  for (const x of v) {
    expect(Number.isFinite(x)).toBe(true);
  }
}

describe("Phase 3: derived geometry", () => {
  const itNode = it.runIf(process.arch !== "arm64");

  itNode("node backend: subpnt/subslr/sincpt/ilumin/occult", async () => {
    const backend = await createBackend({ backend: "node" });
    const pck = await ensureKernelFile(PCK);
    const spk = await ensureKernelFile(SPK);

    backend.kclear();
    backend.furnsh(lskPath);
    backend.furnsh(pck.path);
    backend.furnsh(spk.path);

    const et = 0;

    const subslr = backend.subslr(
      "Near point: ellipsoid",
      "EARTH",
      et,
      "IAU_EARTH",
      "NONE",
      "SUN",
    );
    expectFiniteVec(subslr.spoint);
    expect(Number.isFinite(subslr.trgepc)).toBe(true);
    expectFiniteVec(subslr.srfvec);

    const subpnt = backend.subpnt(
      "Near point: ellipsoid",
      "EARTH",
      et,
      "IAU_EARTH",
      "NONE",
      "SUN",
    );
    expectFiniteVec(subpnt.spoint);
    expect(Number.isFinite(subpnt.trgepc)).toBe(true);
    expectFiniteVec(subpnt.srfvec);

    const { pos: dvec } = backend.spkpos("EARTH", et, "J2000", "NONE", "SUN");
    const sincpt = backend.sincpt(
      "Ellipsoid",
      "EARTH",
      et,
      "IAU_EARTH",
      "NONE",
      "SUN",
      "J2000",
      dvec,
    );
    expect(sincpt.found).toBe(true);
    if (!sincpt.found) throw new Error("Expected found sincpt result");

    const ilumin = backend.ilumin(
      "Ellipsoid",
      "EARTH",
      et,
      "IAU_EARTH",
      "NONE",
      "SUN",
      sincpt.spoint,
    );
    expect(Number.isFinite(ilumin.trgepc)).toBe(true);
    expectFiniteVec(ilumin.srfvec);
    expect(Number.isFinite(ilumin.phase)).toBe(true);
    expect(Number.isFinite(ilumin.solar)).toBe(true);
    expect(Number.isFinite(ilumin.emissn)).toBe(true);

    const occ = backend.occult(
      "MOON",
      "ELLIPSOID",
      "IAU_MOON",
      "SUN",
      "ELLIPSOID",
      "IAU_SUN",
      "NONE",
      "EARTH",
      et,
    );
    expect(occ).toBeGreaterThanOrEqual(-3);
    expect(occ).toBeLessThanOrEqual(3);
  });

  it("wasm backend: subpnt/subslr/sincpt/ilumin/occult", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);
    const pck = await ensureKernelFile(PCK);
    const spk = await ensureKernelFile(SPK);

    backend.kclear();
    backend.loadKernel("naif0012.tls", lskBytes);
    backend.loadKernel(PCK.name, pck.bytes);
    backend.loadKernel(SPK.name, spk.bytes);

    const et = 0;

    const subslr = backend.subslr(
      "Near point: ellipsoid",
      "EARTH",
      et,
      "IAU_EARTH",
      "NONE",
      "SUN",
    );
    expectFiniteVec(subslr.spoint);
    expect(Number.isFinite(subslr.trgepc)).toBe(true);
    expectFiniteVec(subslr.srfvec);

    const subpnt = backend.subpnt(
      "Near point: ellipsoid",
      "EARTH",
      et,
      "IAU_EARTH",
      "NONE",
      "SUN",
    );
    expectFiniteVec(subpnt.spoint);
    expect(Number.isFinite(subpnt.trgepc)).toBe(true);
    expectFiniteVec(subpnt.srfvec);

    const { pos: dvec } = backend.spkpos("EARTH", et, "J2000", "NONE", "SUN");
    const sincpt = backend.sincpt(
      "Ellipsoid",
      "EARTH",
      et,
      "IAU_EARTH",
      "NONE",
      "SUN",
      "J2000",
      dvec,
    );
    expect(sincpt.found).toBe(true);
    if (!sincpt.found) throw new Error("Expected found sincpt result");

    const ilumin = backend.ilumin(
      "Ellipsoid",
      "EARTH",
      et,
      "IAU_EARTH",
      "NONE",
      "SUN",
      sincpt.spoint,
    );
    expect(Number.isFinite(ilumin.trgepc)).toBe(true);
    expectFiniteVec(ilumin.srfvec);
    expect(Number.isFinite(ilumin.phase)).toBe(true);
    expect(Number.isFinite(ilumin.solar)).toBe(true);
    expect(Number.isFinite(ilumin.emissn)).toBe(true);

    const occ = backend.occult(
      "MOON",
      "ELLIPSOID",
      "IAU_MOON",
      "SUN",
      "ELLIPSOID",
      "IAU_SUN",
      "NONE",
      "EARTH",
      et,
    );
    expect(occ).toBeGreaterThanOrEqual(-3);
    expect(occ).toBeLessThanOrEqual(3);
  });
});
