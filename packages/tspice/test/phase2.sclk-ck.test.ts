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

describe("Phase 2: SCLK + CK attitude", () => {
  const itNode = it.runIf(process.arch !== "arm64");

  itNode("node backend: scs2e/sce2s", async () => {
    const backend = await createBackend({ backend: "node" });

    backend.kclear();
    backend.furnsh(tlsPath);
    backend.furnsh(tscPath);

    // NOTE: Use -77 (per the CSPICE cookbook). If this fails, we want the test
    // to fail to catch sign marshalling or SCLK mapping issues.
    const sc = -77;
    const et = backend.scs2e(sc, sclkch);
    expect(Number.isFinite(et)).toBe(true);

    const roundTrip = backend.sce2s(sc, et);
    expect(roundTrip.length).toBeGreaterThan(0);
  });

  itNode("node backend: loading transfer-format CK throws", async () => {
    const backend = await createBackend({ backend: "node" });

    backend.kclear();
    backend.furnsh(tlsPath);
    backend.furnsh(tscPath);

    // Transfer-format CKs (like cook_01.tc) are not loadable by CSPICE.
    expect(() => backend.furnsh(tcPath)).toThrow(/TRANSFERFILE/i);
  });

  it("wasm backend: scs2e/sce2s", async () => {
    const backend = await createBackend({ backend: "wasm" });

    const tlsBytes = fs.readFileSync(tlsPath);
    const tscBytes = fs.readFileSync(tscPath);

    backend.kclear();
    backend.loadKernel("cook_01.tls", tlsBytes);
    backend.loadKernel("cook_01.tsc", tscBytes);

    // NOTE: Use -77 (per the CSPICE cookbook). If this fails, we want the test
    // to fail to catch sign marshalling or SCLK mapping issues.
    const sc = -77;
    const et = backend.scs2e(sc, sclkch);
    expect(Number.isFinite(et)).toBe(true);

    const roundTrip = backend.sce2s(sc, et);
    expect(roundTrip.length).toBeGreaterThan(0);
  });

  it("wasm backend: loading transfer-format CK throws", async () => {
    const backend = await createBackend({ backend: "wasm" });

    const tlsBytes = fs.readFileSync(tlsPath);
    const tscBytes = fs.readFileSync(tscPath);
    const tcBytes = fs.readFileSync(tcPath);

    backend.kclear();
    backend.loadKernel("cook_01.tls", tlsBytes);
    backend.loadKernel("cook_01.tsc", tscBytes);

    // Transfer-format CKs (like cook_01.tc) are not loadable by CSPICE.
    expect(() => backend.loadKernel("cook_01.tc", tcBytes)).toThrow(/TRANSFERFILE/i);
  });

  // TODO: Add a binary CK (e.g. .bc) fixture so we can test ckgp/ckgpav
  // happy-path behavior across backends.
});
