import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
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

function vsub(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
}

function vdot(a: readonly number[], b: readonly number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

function vnorm(a: readonly number[]): number {
  return Math.sqrt(vdot(a, a));
}

function vhat(a: readonly number[]): [number, number, number] {
  const n = vnorm(a);
  if (n === 0) return [0, 0, 0];
  return [a[0]! / n, a[1]! / n, a[2]! / n];
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

function angleBetween(a: readonly number[], b: readonly number[]): number {
  const na = vnorm(a);
  const nb = vnorm(b);
  if (na === 0 || nb === 0) return 0;
  return Math.acos(clamp(vdot(a, b) / (na * nb), -1, 1));
}

function ellipsoidSurfaceNormal(opts: {
  spoint: readonly [number, number, number];
  radii: readonly [number, number, number];
}): [number, number, number] {
  const [x, y, z] = opts.spoint;
  const [a, b, c] = opts.radii;

  // Gradient of x^2/a^2 + y^2/b^2 + z^2/c^2 = 1 is [x/a^2, y/b^2, z/c^2]
  return vhat([
    x / (a * a),
    y / (b * b),
    z / (c * c),
  ]);
}

async function furnishNaifKernels(backend: Awaited<ReturnType<typeof createBackend>>, backendKind: "node" | "wasm") {
  const pck = await ensureKernelFile(PCK);
  const spk = await ensureKernelFile(SPK);

  backend.kclear();

  if (backendKind === "node") {
    backend.furnsh(lskPath);
    backend.furnsh(pck.path);
    backend.furnsh(spk.path);
    return;
  }

  const lskBytes = fs.readFileSync(lskPath);
  backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });
  backend.furnsh({ path: `${PCK.name}`, bytes: pck.bytes });
  backend.furnsh({ path: `${SPK.name}`, bytes: spk.bytes });
}

describe("geometry classic", () => {
  const itNode = it.runIf(nodeBackendAvailable && process.arch !== "arm64");

  async function runIllumScenario(backendKind: "node" | "wasm") {
    const backend = await createBackend({ backend: backendKind });
    await furnishNaifKernels(backend, backendKind);

    const et = 0;
    const subpntMethod = "Near point: Ellipsoid";
    const illumMethod = "ELLIPSOID";
    const target = "MOON";
    const fixref = "IAU_MOON";
    const abcorr = "NONE";
    const observer = "EARTH";
    const ilusrc = "SUN";

    const { spoint } = backend.subpnt(subpntMethod, target, et, fixref, abcorr, observer);

    const g = backend.illumg(illumMethod, target, ilusrc, et, fixref, abcorr, observer, spoint);
    const f = backend.illumf(illumMethod, target, ilusrc, et, fixref, abcorr, observer, spoint);

    // Compute expected illumination angles from definitions (no aberration corrections).
    const radii = backend.bodvar(301, "RADII");
    expect(radii).toHaveLength(3);
    const radii3 = [radii[0]!, radii[1]!, radii[2]!] as const;

    const normal = ellipsoidSurfaceNormal({ spoint, radii: radii3 });
    const obspos = backend.spkpos(observer, et, fixref, abcorr, target).pos as [number, number, number];
    const srcpos = backend.spkpos(ilusrc, et, fixref, abcorr, target).pos as [number, number, number];

    const srfToObs = vsub(obspos, spoint);
    const srfToSrc = vsub(srcpos, spoint);

    const expectedPhase = angleBetween(srfToSrc, srfToObs);
    const expectedIncdnc = angleBetween(normal, srfToSrc);
    const expectedEmissn = angleBetween(normal, srfToObs);

    // --- illumg ---
    expect(g.trgepc).toBeCloseTo(et, 12);
    expect(g.srfvec).toHaveLength(3);
    expect(g.phase).toBeCloseTo(expectedPhase, 11);
    expect(g.incdnc).toBeCloseTo(expectedIncdnc, 11);
    expect(g.emissn).toBeCloseTo(expectedEmissn, 11);

    // At the sub-observer point, emission should be (very nearly) 0.
    expect(g.emissn).toBeLessThan(1e-10);

    // --- illumf ---
    expect(f.trgepc).toBeCloseTo(et, 12);
    expect(f.phase).toBeCloseTo(g.phase, 12);
    expect(f.incdnc).toBeCloseTo(g.incdnc, 12);
    expect(f.emissn).toBeCloseTo(g.emissn, 12);
    expect(f.visibl).toBe(true);
    expect(f.lit).toBe(expectedIncdnc <= Math.PI / 2);
  }

  it("wasm backend: illumg/illumf matches geometric expectations", async () => {
    await runIllumScenario("wasm");
  }, 60_000);

  itNode("node backend: illumg/illumf matches geometric expectations", async () => {
    await runIllumScenario("node");
  }, 60_000);

  async function runSincptMissScenario(backendKind: "node" | "wasm") {
    const backend = await createBackend({ backend: backendKind });
    await furnishNaifKernels(backend, backendKind);

    const et = 0;
    const method = "ELLIPSOID";
    const target = "MOON";
    const fixref = "IAU_MOON";
    const abcorr = "NONE";
    const observer = "EARTH";
    const dref = "J2000";

    const { pos: obsToTarg } = backend.spkpos(target, et, dref, abcorr, observer);
    const dvec: [number, number, number] = [-obsToTarg[0]!, -obsToTarg[1]!, -obsToTarg[2]!];

    const out = backend.sincpt(method, target, et, fixref, abcorr, observer, dref, dvec);
    expect(out).toEqual({ found: false });
  }

  it("wasm backend: sincpt miss returns {found:false}", async () => {
    await runSincptMissScenario("wasm");
  }, 60_000);

  itNode("node backend: sincpt miss returns {found:false}", async () => {
    await runSincptMissScenario("node");
  }, 60_000);

  itNode("node↔wasm parity: nvc2pl/pl2nvc", async () => {
    const node = await createBackend({ backend: "node" });
    const wasm = await createBackend({ backend: "wasm" });

    const normal: [number, number, number] = [1, 2, 3];
    const konst = 4;

    const planeNode = node.nvc2pl(normal, konst);
    const planeWasm = wasm.nvc2pl(normal, konst);

    expect(planeNode).toHaveLength(4);
    expect(planeWasm).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(planeNode[i]!).toBeCloseTo(planeWasm[i]!, 12);
    }

    const outNode = node.pl2nvc(planeNode);
    const outWasm = wasm.pl2nvc(planeWasm);

    expect(outNode.normal).toHaveLength(3);
    expect(outWasm.normal).toToHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(outNode.normal[i]!).toBeCloseTo(outWasm.normal[i]!, 12);
    }
    expect(outNode.konst).toBeCloseTo(outWasm.konst, 12);
  }, 60_000);
});
