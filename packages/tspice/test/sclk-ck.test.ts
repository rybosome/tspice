import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { spiceClients } from "@rybosome/tspice";

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
    const { spice, dispose } = await spiceClients.toSync({ backend: "node" });
    const backend = spice.raw;
    try {

    backend.kclear();
    backend.furnsh(lskPath);
    backend.furnsh(tscPath);

    const et = backend.scs2e(sc, sclkch);
    expect(Number.isFinite(et)).toBe(true);

    const roundTrip = backend.sce2s(sc, et);
    expect(roundTrip.length).toBeGreaterThan(0);
    } finally {
      await dispose();
    }
  });

  itNode("node backend: ckgp/ckgpav throw when no CK is loaded", async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend: "node" });
    const backend = spice.raw;
    try {

    backend.kclear();

    const inst = -77001;
    const sclkdp = 4319435080.0;
    const tol = 0.0;
    const ref = "J2000";

    expect(() => backend.ckgp(inst, sclkdp, tol, ref)).toThrow(/NOLOADEDFILES|CKLPF/i);
    expect(() => backend.ckgpav(inst, sclkdp, tol, ref)).toThrow(/NOLOADEDFILES|CKLPF/i);
    } finally {
      await dispose();
    }
  });

  itNode("node backend: loading transfer-format CK throws", async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend: "node" });
    const backend = spice.raw;
    try {

    backend.kclear();
    backend.furnsh(lskPath);
    backend.furnsh(tscPath);

    // Transfer-format CKs (like cook_01.tc) are not loadable by CSPICE.
    expect(() => backend.furnsh(tcPath)).toThrow(/TRANSFERFILE/i);
    } finally {
      await dispose();
    }
  });

  it("wasm backend: scs2e/sce2s", async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });
    const backend = spice.raw;
    try {

    const lskBytes = fs.readFileSync(lskPath);
    const tscBytes = fs.readFileSync(tscPath);

    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });
    backend.furnsh({ path: "cook_01.tsc", bytes: tscBytes });

    const et = backend.scs2e(sc, sclkch);
    expect(Number.isFinite(et)).toBe(true);

    const roundTrip = backend.sce2s(sc, et);
    expect(roundTrip.length).toBeGreaterThan(0);
    } finally {
      await dispose();
    }
  });

  it("wasm backend: ckgp/ckgpav throw when no CK is loaded", async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });
    const backend = spice.raw;
    try {

    backend.kclear();

    const inst = -77001;
    const sclkdp = 4319435080.0;
    const tol = 0.0;
    const ref = "J2000";

    expect(() => backend.ckgp(inst, sclkdp, tol, ref)).toThrow(/NOLOADEDFILES|CKLPF/i);
    expect(() => backend.ckgpav(inst, sclkdp, tol, ref)).toThrow(/NOLOADEDFILES|CKLPF/i);
    } finally {
      await dispose();
    }
  });

  it("wasm backend: loading transfer-format CK throws", async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });
    const backend = spice.raw;
    try {

    const lskBytes = fs.readFileSync(lskPath);
    const tscBytes = fs.readFileSync(tscPath);
    const tcBytes = fs.readFileSync(tcPath);

    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });
    backend.furnsh({ path: "cook_01.tsc", bytes: tscBytes });

    // Transfer-format CKs (like cook_01.tc) are not loadable by CSPICE.
    expect(() => backend.furnsh({ path: "cook_01.tc", bytes: tcBytes })).toThrow(/TRANSFERFILE/i);
    } finally {
      await dispose();
    }
  });

  // TODO: Add a binary CK (e.g. .bc) fixture so we can test ckgp/ckgpav
  // happy-path behavior across backends.
});
