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

const SCLK = {
  name: "mk00062a.tsc",
  url: "https://naif.jpl.nasa.gov/pub/naif/GLL/kernels/sclk/mk00062a.tsc",
  sha256: "cea5234f9769f83aa6da65f360c6940a70b72461ed2c577cb531448e7498295c",
} as const;

const CK = {
  name: "gll_plt_rec_1994_tav_v00.bc",
  url: "https://naif.jpl.nasa.gov/pub/naif/GLL/kernels/ck/gll_plt_rec_1994_tav_v00.bc",
  sha256: "34b0ec4095d9835e9086ae3ec2d98296e7e230d033f557b7a317d2d740c0a84d",
} as const;

function mat3TimesMat3T(m: number[]): number[] {
  const out = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += m[i * 3 + k]! * m[j * 3 + k]!;
      }
      out[i * 3 + j] = sum;
    }
  }
  return out;
}

describe("Phase 4: SCLK conversion + CK pointing", () => {
  // Galileo Orbiter.
  const sc = -77;
  // Galileo scan platform.
  const inst = -77001;

  // Strategy: choose `sclkdp = 0` with a huge tolerance so CSPICE can return any
  // available pointing record without hard-coding an exact encoded time.
  const sclkdp = 0;
  const tol = 1e20;
  const ref = "J2000";

  const itNode = it.runIf(nodeBackendAvailable && process.arch !== "arm64");

  itNode("node backend: scs2e/sce2s/ckgp/ckgpav", async () => {
    const backend = await createBackend({ backend: "node" });
    const sclk = await ensureKernelFile(SCLK);
    const ck = await ensureKernelFile(CK);

    backend.kclear();
    backend.furnsh(lskPath);
    backend.furnsh(sclk.path);
    backend.furnsh(ck.path);

    const sclkch = backend.sce2s(sc, 0);
    expect(sclkch).toBeTypeOf("string");
    expect(sclkch.length).toBeGreaterThan(0);

    const et = backend.scs2e(sc, sclkch);
    expect(et).toBeTypeOf("number");
    expect(Number.isFinite(et)).toBe(true);

    const p = backend.ckgp(inst, sclkdp, tol, ref);
    expect(p.found).toBe(true);
    if (p.found) {
      expect(p.cmat).toHaveLength(9);
      expect(p.clkout).toBeTypeOf("number");
      const identish = mat3TimesMat3T([...p.cmat]);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const expected = i === j ? 1 : 0;
          expect(Math.abs(identish[i * 3 + j]! - expected)).toBeLessThan(1e-9);
        }
      }
    }

    const pav = backend.ckgpav(inst, sclkdp, tol, ref);
    expect(pav.found).toBe(true);
    if (pav.found) {
      expect(pav.cmat).toHaveLength(9);
      expect(pav.av).toHaveLength(3);
      expect(pav.clkout).toBeTypeOf("number");
      for (const x of pav.av) {
        expect(Number.isFinite(x)).toBe(true);
      }
    }
  }, 60_000);

  it("wasm backend: scs2e/sce2s/ckgp/ckgpav", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);
    const sclk = await ensureKernelFile(SCLK);
    const ck = await ensureKernelFile(CK);

    backend.kclear();
    backend.loadKernel("naif0012.tls", lskBytes);
    backend.loadKernel(SCLK.name, sclk.bytes);
    backend.loadKernel(CK.name, ck.bytes);

    const sclkch = backend.sce2s(sc, 0);
    expect(sclkch).toBeTypeOf("string");
    expect(sclkch.length).toBeGreaterThan(0);

    const et = backend.scs2e(sc, sclkch);
    expect(et).toBeTypeOf("number");
    expect(Number.isFinite(et)).toBe(true);

    const p = backend.ckgp(inst, sclkdp, tol, ref);
    expect(p.found).toBe(true);
    if (p.found) {
      expect(p.cmat).toHaveLength(9);
      expect(p.clkout).toBeTypeOf("number");
      const identish = mat3TimesMat3T([...p.cmat]);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const expected = i === j ? 1 : 0;
          expect(Math.abs(identish[i * 3 + j]! - expected)).toBeLessThan(1e-9);
        }
      }
    }

    const pav = backend.ckgpav(inst, sclkdp, tol, ref);
    expect(pav.found).toBe(true);
    if (pav.found) {
      expect(pav.cmat).toHaveLength(9);
      expect(pav.av).toHaveLength(3);
      expect(pav.clkout).toBeTypeOf("number");
      for (const x of pav.av) {
        expect(Number.isFinite(x)).toBe(true);
      }
    }
  }, 60_000);
});
