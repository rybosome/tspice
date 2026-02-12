import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lskPath = path.join(__dirname, "fixtures", "kernels", "naif0012.tls");
const tscPath = path.join(__dirname, "fixtures", "kernels", "cook_01.tsc");
const tcPath = path.join(__dirname, "fixtures", "kernels", "cook_01.tc");

const mgsSclkPath = path.join(
  __dirname,
  "fixtures",
  "kernels",
  "mgs-minimal",
  "mgs_sclkscet_00061.tsc",
);
const mgsCkPath = path.join(
  __dirname,
  "fixtures",
  "kernels",
  "mgs-minimal",
  "mgs_hga_hinge_v2.bc",
);

// Constants derived from cook_01.tsc / cook_01.tc (CSPICE "cookbook" data).
const sc = -77;
const sclkch = "593328:90:5:0";

describe("SCLK conversions + CK attitude", () => {
  const itNode = it.runIf(nodeBackendAvailable && process.arch !== "arm64");

  itNode("node backend: scs2e/sce2s", async () => {
    const backend = await createBackend({ backend: "node" });

    backend.kclear();
    backend.furnsh(lskPath);
    backend.furnsh(tscPath);

    const et = backend.scs2e(sc, sclkch);
    expect(Number.isFinite(et)).toBe(true);

    const roundTrip = backend.sce2s(sc, et);
    expect(roundTrip.length).toBeGreaterThan(0);
  });

  itNode("node backend: scencd/scdecd + sce2c/sct2e + unitim", async () => {
    const backend = await createBackend({ backend: "node" });

    backend.kclear();
    backend.furnsh(lskPath);
    backend.furnsh(tscPath);

    const sclkdp = backend.scencd(sc, sclkch);
    expect(Number.isFinite(sclkdp)).toBe(true);

    const decoded = backend.scdecd(sc, sclkdp);
    expect(decoded.length).toBeGreaterThan(0);

    // Roundtrip-ish: ticks <-> ET.
    const et = backend.scs2e(sc, sclkch);
    const ticks = backend.sce2c(sc, et);
    const et2 = backend.sct2e(sc, ticks);
    expect(Math.abs(et2 - et)).toBeLessThan(1e-6);

    // Roundtrip-ish: ET <-> TAI.
    const tai = backend.unitim(et, "ET", "TAI");
    const et3 = backend.unitim(tai, "TAI", "ET");
    expect(Math.abs(et3 - et)).toBeLessThan(1e-6);
  });

  itNode("node backend: deltet/unitim throw when no LSK is loaded", async () => {
    const backend = await createBackend({ backend: "node" });

    backend.kclear();

    expect(() => backend.deltet(0, "ET")).toThrow(/NOLEAPSECONDS|KERNELVARNOTFOUND|MISSINGTIMEINFO/i);
    expect(() => backend.unitim(0, "ET", "TAI")).toThrow(/NOLEAPSECONDS|KERNELVARNOTFOUND|MISSINGTIMEINFO/i);
  });

  itNode("node backend: scencd throws when no SCLK is loaded", async () => {
    const backend = await createBackend({ backend: "node" });

    backend.kclear();
    backend.furnsh(lskPath);

    expect(() => backend.scencd(sc, sclkch)).toThrow(/SCLK/i);
  });

  itNode("node backend: ckgp/ckgpav throw when no CK is loaded", async () => {
    const backend = await createBackend({ backend: "node" });

    backend.kclear();

    const inst = -77001;
    const sclkdp = 4319435080.0;
    const tol = 0.0;
    const ref = "J2000";

    expect(() => backend.ckgp(inst, sclkdp, tol, ref)).toThrow(/NOLOADEDFILES|CKLPF/i);
    expect(() => backend.ckgpav(inst, sclkdp, tol, ref)).toThrow(/NOLOADEDFILES|CKLPF/i);
  });

  itNode("node backend: loading transfer-format CK throws", async () => {
    const backend = await createBackend({ backend: "node" });

    backend.kclear();
    backend.furnsh(lskPath);
    backend.furnsh(tscPath);

    // Transfer-format CKs (like cook_01.tc) are not loadable by CSPICE.
    expect(() => backend.furnsh(tcPath)).toThrow(/TRANSFERFILE/i);
  });

  it("wasm backend: scs2e/sce2s", async () => {
    const backend = await createBackend({ backend: "wasm" });

    const lskBytes = fs.readFileSync(lskPath);
    const tscBytes = fs.readFileSync(tscPath);

    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });
    backend.furnsh({ path: "cook_01.tsc", bytes: tscBytes });

    const et = backend.scs2e(sc, sclkch);
    expect(Number.isFinite(et)).toBe(true);

    const roundTrip = backend.sce2s(sc, et);
    expect(roundTrip.length).toBeGreaterThan(0);
  });

  it("wasm backend: scencd/scdecd + sce2c/sct2e + unitim", async () => {
    const backend = await createBackend({ backend: "wasm" });

    const lskBytes = fs.readFileSync(lskPath);
    const tscBytes = fs.readFileSync(tscPath);

    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });
    backend.furnsh({ path: "cook_01.tsc", bytes: tscBytes });

    const sclkdp = backend.scencd(sc, sclkch);
    expect(Number.isFinite(sclkdp)).toBe(true);

    const decoded = backend.scdecd(sc, sclkdp);
    expect(decoded.length).toBeGreaterThan(0);

    const et = backend.scs2e(sc, sclkch);
    const ticks = backend.sce2c(sc, et);
    const et2 = backend.sct2e(sc, ticks);
    expect(Math.abs(et2 - et)).toBeLessThan(1e-6);

    const tai = backend.unitim(et, "ET", "TAI");
    const et3 = backend.unitim(tai, "TAI", "ET");
    expect(Math.abs(et3 - et)).toBeLessThan(1e-6);
  });

  it("wasm backend: deltet/unitim throw when no LSK is loaded", async () => {
    const backend = await createBackend({ backend: "wasm" });

    backend.kclear();

    expect(() => backend.deltet(0, "ET")).toThrow(/NOLEAPSECONDS|KERNELVARNOTFOUND|MISSINGTIMEINFO/i);
    expect(() => backend.unitim(0, "ET", "TAI")).toThrow(/NOLEAPSECONDS|KERNELVARNOTFOUND|MISSINGTIMEINFO/i);
  });

  it("wasm backend: scencd throws when no SCLK is loaded", async () => {
    const backend = await createBackend({ backend: "wasm" });

    const lskBytes = fs.readFileSync(lskPath);

    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });

    expect(() => backend.scencd(sc, sclkch)).toThrow(/SCLK/i);
  });

  it("wasm backend: ckgp/ckgpav throw when no CK is loaded", async () => {
    const backend = await createBackend({ backend: "wasm" });

    backend.kclear();

    const inst = -77001;
    const sclkdp = 4319435080.0;
    const tol = 0.0;
    const ref = "J2000";

    expect(() => backend.ckgp(inst, sclkdp, tol, ref)).toThrow(/NOLOADEDFILES|CKLPF/i);
    expect(() => backend.ckgpav(inst, sclkdp, tol, ref)).toThrow(/NOLOADEDFILES|CKLPF/i);
  });

  it("wasm backend: loading transfer-format CK throws", async () => {
    const backend = await createBackend({ backend: "wasm" });

    const lskBytes = fs.readFileSync(lskPath);
    const tscBytes = fs.readFileSync(tscPath);
    const tcBytes = fs.readFileSync(tcPath);

    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });
    backend.furnsh({ path: "cook_01.tsc", bytes: tscBytes });

    // Transfer-format CKs (like cook_01.tc) are not loadable by CSPICE.
    expect(() => backend.furnsh({ path: "cook_01.tc", bytes: tcBytes })).toThrow(/TRANSFERFILE/i);
  });

  itNode("node backend: CK read-only happy path (cklpf/ckobj/ckcov/ckupf)", async () => {
    const backend = await createBackend({ backend: "node" });

    backend.kclear();
    backend.furnsh(lskPath);
    backend.furnsh(mgsSclkPath);

    // Load CK via cklpf/ckupf so we can validate the handle-based unload path.
    const ckHandle = backend.cklpf(mgsCkPath);

    const ids = backend.newIntCell(32);
    const cover = backend.newWindow(128);

    let inst = 0;
    let sclkdp = 0;

    try {
      backend.ckobj(mgsCkPath, ids);
      const nIds = backend.card(ids);
      expect(nIds).toBeGreaterThan(0);

      inst = backend.cellGeti(ids, 0);

      backend.ckcov(mgsCkPath, inst, false, "SEGMENT", 0.0, "SCLK", cover);
      const nIntervals = backend.wncard(cover);
      expect(nIntervals).toBeGreaterThan(0);

      const [left, right] = backend.wnfetd(cover, 0);
      sclkdp = (left + right) / 2;
      const tol = Math.max(1, (right - left) / 2);

      const out = backend.ckgp(inst, sclkdp, tol, "MGS_SPACECRAFT");
      expect(out.found).toBe(true);
    } finally {
      backend.freeCell(ids);
      backend.freeWindow(cover);
      backend.ckupf(ckHandle);
    }

    expect(() => backend.ckgp(inst, sclkdp, 0.0, "MGS_SPACECRAFT")).toThrow(/NOLOADEDFILES|CKLPF/i);
  });

  it("wasm backend: CK read-only happy path (cklpf/ckobj/ckcov/ckupf)", async () => {
    const backend = await createBackend({ backend: "wasm" });

    const lskBytes = fs.readFileSync(lskPath);
    const sclkBytes = fs.readFileSync(mgsSclkPath);
    const ckBytes = fs.readFileSync(mgsCkPath);

    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });
    backend.furnsh({ path: "mgs_sclkscet_00061.tsc", bytes: sclkBytes });

    // Stage CK bytes into the WASM FS via furnsh, then unload so cklpf controls
    // the loaded-state for this test.
    backend.furnsh({ path: "mgs_hga_hinge_v2.bc", bytes: ckBytes });
    backend.unload("mgs_hga_hinge_v2.bc");

    const ckHandle = backend.cklpf("mgs_hga_hinge_v2.bc");

    const ids = backend.newIntCell(32);
    const cover = backend.newWindow(128);

    let inst = 0;
    let sclkdp = 0;

    try {
      backend.ckobj("mgs_hga_hinge_v2.bc", ids);
      const nIds = backend.card(ids);
      expect(nIds).toBeGreaterThan(0);

      inst = backend.cellGeti(ids, 0);

      backend.ckcov("mgs_hga_hinge_v2.bc", inst, false, "SEGMENT", 0.0, "SCLK", cover);
      const nIntervals = backend.wncard(cover);
      expect(nIntervals).toBeGreaterThan(0);

      const [left, right] = backend.wnfetd(cover, 0);
      sclkdp = (left + right) / 2;
      const tol = Math.max(1, (right - left) / 2);

      const out = backend.ckgp(inst, sclkdp, tol, "MGS_SPACECRAFT");
      expect(out.found).toBe(true);
    } finally {
      backend.freeCell(ids);
      backend.freeWindow(cover);
      backend.ckupf(ckHandle);
    }

    expect(() => backend.ckgp(inst, sclkdp, 0.0, "MGS_SPACECRAFT")).toThrow(/NOLOADEDFILES|CKLPF/i);
  });
});
