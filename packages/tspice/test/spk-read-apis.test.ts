import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

import { ensureKernelFile } from "./helpers/kernels.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

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

function expectStatesClose(a: number[], b: number[], tol = 1e-9) {
  expect(a).toHaveLength(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(Math.abs((a[i] ?? 0) - (b[i] ?? 0))).toBeLessThan(tol);
  }
}

describe("SPK read APIs + coverage/object queries", () => {
  const itNode = it.runIf(nodeBackendAvailable && process.arch !== "arm64");

  itNode("node backend: spkez + spkcov/spkobj", async () => {
    const backend = await createBackend({ backend: "node" });
    const pck = await ensureKernelFile(PCK);
    const spk = await ensureKernelFile(SPK);

    backend.kclear();
    backend.furnsh(lskPath);
    backend.furnsh(pck.path);
    backend.furnsh(spk.path);

    const { state: stateStr, lt: ltStr } = backend.spkezr("EARTH", 0, "J2000", "NONE", "SUN");
    const { state: stateNum, lt: ltNum } = backend.spkez(399, 0, "J2000", "NONE", 10);

    expect(stateNum).toHaveLength(6);
    expect(ltNum).toBeGreaterThan(0);
    expectStatesClose([...stateNum], [...stateStr]);
    expect(Math.abs(ltNum - ltStr)).toBeLessThan(1e-9);

    const ids = backend.newIntCell(1000);
    backend.spkobj(spk.path, ids);
    const idCount = backend.card(ids);
    expect(idCount).toBeGreaterThan(0);

    const idList: number[] = [];
    for (let i = 0; i < idCount; i++) {
      idList.push(backend.cellGeti(ids, i));
    }
    expect(idList).toContain(399);

    const cover = backend.newWindow(16);
    backend.spkcov(spk.path, 399, cover);
    const nIntervals = backend.wncard(cover);
    expect(nIntervals).toBeGreaterThan(0);

    let coversJ2000 = false;
    for (let i = 0; i < nIntervals; i++) {
      const [left, right] = backend.wnfetd(cover, i);
      if (left <= 0 && right >= 0) {
        coversJ2000 = true;
      }
    }
    expect(coversJ2000).toBe(true);

    backend.freeWindow(cover);
    backend.freeCell(ids);
  }, 60_000);

  it("wasm backend: spkez + spkcov/spkobj", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);
    const pck = await ensureKernelFile(PCK);
    const spk = await ensureKernelFile(SPK);

    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });
    backend.furnsh({ path: `${PCK.name}`, bytes: pck.bytes });
    backend.furnsh({ path: `${SPK.name}`, bytes: spk.bytes });

    const { state: stateStr, lt: ltStr } = backend.spkezr("EARTH", 0, "J2000", "NONE", "SUN");
    const { state: stateNum, lt: ltNum } = backend.spkez(399, 0, "J2000", "NONE", 10);

    expect(stateNum).toHaveLength(6);
    expect(ltNum).toBeGreaterThan(0);
    expectStatesClose([...stateNum], [...stateStr]);
    expect(Math.abs(ltNum - ltStr)).toBeLessThan(1e-9);

    const ids = backend.newIntCell(1000);
    backend.spkobj(SPK.name, ids);
    const idCount = backend.card(ids);
    expect(idCount).toBeGreaterThan(0);

    const idList: number[] = [];
    for (let i = 0; i < idCount; i++) {
      idList.push(backend.cellGeti(ids, i));
    }
    expect(idList).toContain(399);

    const cover = backend.newWindow(16);
    backend.spkcov(SPK.name, 399, cover);
    const nIntervals = backend.wncard(cover);
    expect(nIntervals).toBeGreaterThan(0);

    let coversJ2000 = false;
    for (let i = 0; i < nIntervals; i++) {
      const [left, right] = backend.wnfetd(cover, i);
      if (left <= 0 && right >= 0) {
        coversJ2000 = true;
      }
    }
    expect(coversJ2000).toBe(true);

    backend.freeWindow(cover);
    backend.freeCell(ids);
  }, 60_000);
});
