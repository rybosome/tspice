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

  // TODO: Add a binary CK (e.g. .bc) fixture so we can test ckgp/ckgpav
  // happy-path behavior across backends.
});
