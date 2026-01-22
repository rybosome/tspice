import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tlsPath = path.join(__dirname, "fixtures", "kernels", "cook_01.tls");
const tscPath = path.join(__dirname, "fixtures", "kernels", "cook_01.tsc");
const tcPath = path.join(__dirname, "fixtures", "kernels", "cook_01.tc");

// Constants derived from cook_01.* (CSPICE "cookbook" data).
const inst = -77001;
const sclkdp = 4319435080.0;
const sclkch = "593328:90:5:0";
const ref = "J2000";
const tol = 0.0;

function computeEtOrFallback(
  scs2e: (sc: number, sclkch: string) => number,
): { sc: number; et: number } {
  // Some CSPICE examples use SCLK IDs with different sign conventions. Prefer -77
  // (per the cookbook), but fall back to 77 if the kernel mapping doesn't include -77.
  try {
    return { sc: -77, et: scs2e(-77, sclkch) };
  } catch {
    return { sc: 77, et: scs2e(77, sclkch) };
  }
}

describe("Phase 2: SCLK + CK attitude", () => {
  const itNode = it.runIf(process.arch !== "arm64");

  itNode("node backend: scs2e/sce2s/ckgp/ckgpav", async () => {
    const backend = await createBackend({ backend: "node" });

    backend.kclear();
    backend.furnsh(tlsPath);
    backend.furnsh(tscPath);
    backend.furnsh(tcPath);

    const { sc, et } = computeEtOrFallback((sc, sclkch) => backend.scs2e(sc, sclkch));
    expect(Number.isFinite(et)).toBe(true);

    const roundTrip = backend.sce2s(sc, et);
    expect(roundTrip.length).toBeGreaterThan(0);

    const ckgpOut = backend.ckgp(inst, sclkdp, tol, ref);
    expect(ckgpOut.found).toBe(true);
    if (ckgpOut.found) {
      expect(ckgpOut.cmat.length).toBe(9);
    }

    const ckgpavOut = backend.ckgpav(inst, sclkdp, tol, ref);
    expect(ckgpavOut.found).toBe(true);
    if (ckgpavOut.found) {
      expect(ckgpavOut.cmat.length).toBe(9);
      expect(ckgpavOut.av.length).toBe(3);
    }
  });

  it.skip("wasm backend: scs2e/sce2s/ckgp/ckgpav", async () => {
    const backend = await createBackend({ backend: "wasm" });

    const tlsBytes = fs.readFileSync(tlsPath);
    const tscBytes = fs.readFileSync(tscPath);
    const tcBytes = fs.readFileSync(tcPath);

    backend.kclear();
    backend.loadKernel("cook_01.tls", tlsBytes);
    backend.loadKernel("cook_01.tsc", tscBytes);
    backend.loadKernel("cook_01.tc", tcBytes);

    const { sc, et } = computeEtOrFallback((sc, sclkch) => backend.scs2e(sc, sclkch));
    expect(Number.isFinite(et)).toBe(true);

    const roundTrip = backend.sce2s(sc, et);
    expect(roundTrip.length).toBeGreaterThan(0);

    const ckgpOut = backend.ckgp(inst, sclkdp, tol, ref);
    expect(ckgpOut.found).toBe(true);
    if (ckgpOut.found) {
      expect(ckgpOut.cmat.length).toBe(9);
    }

    const ckgpavOut = backend.ckgpav(inst, sclkdp, tol, ref);
    expect(ckgpavOut.found).toBe(true);
    if (ckgpavOut.found) {
      expect(ckgpavOut.cmat.length).toBe(9);
      expect(ckgpavOut.av.length).toBe(3);
    }
  });
});
