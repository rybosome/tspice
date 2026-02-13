import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { spiceClients } from "@rybosome/tspice";

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

describe("frames + SPK ephemerides", () => {
  const itNode = it.runIf(nodeBackendAvailable);

  itNode("node backend: pxform/sxform/spkezr/spkpos", async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend: "node" });
    const backend = spice.raw;
    try {
      const pck = await ensureKernelFile(PCK);
      const spk = await ensureKernelFile(SPK);

    backend.kclear();
    backend.furnsh(lskPath);
    backend.furnsh(pck.path);
    backend.furnsh(spk.path);

    const rot = backend.pxform("J2000", "IAU_EARTH", 0);
    expect(rot).toHaveLength(9);
    const identish = mat3TimesMat3T([...rot]);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const expected = i === j ? 1 : 0;
        expect(Math.abs(identish[i * 3 + j]! - expected)).toBeLessThan(1e-9);
      }
    }

    const xform = backend.sxform("J2000", "IAU_EARTH", 0);
    expect(xform).toHaveLength(36);

    const { state, lt } = backend.spkezr("EARTH", 0, "J2000", "NONE", "SUN");
    expect(state).toHaveLength(6);
    expect(lt).toBeGreaterThan(0);

      const { pos, lt: lt2 } = backend.spkpos("EARTH", 0, "J2000", "NONE", "SUN");
      expect(pos).toHaveLength(3);
      expect(lt2).toBeGreaterThan(0);
    } finally {
      await dispose();
    }
  }, 60_000);

  it("wasm backend: pxform/sxform/spkezr/spkpos", async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend: "wasm" });
    const backend = spice.raw;
    try {
      const lskBytes = fs.readFileSync(lskPath);
      const pck = await ensureKernelFile(PCK);
      const spk = await ensureKernelFile(SPK);

    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });
    backend.furnsh({ path: `${PCK.name}`, bytes: pck.bytes });
    backend.furnsh({ path: `${SPK.name}`, bytes: spk.bytes });

    const rot = backend.pxform("J2000", "IAU_EARTH", 0);
    expect(rot).toHaveLength(9);
    const identish = mat3TimesMat3T([...rot]);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const expected = i === j ? 1 : 0;
        expect(Math.abs(identish[i * 3 + j]! - expected)).toBeLessThan(1e-9);
      }
    }

    const xform = backend.sxform("J2000", "IAU_EARTH", 0);
    expect(xform).toHaveLength(36);

    const { state, lt } = backend.spkezr("EARTH", 0, "J2000", "NONE", "SUN");
    expect(state).toHaveLength(6);
    expect(lt).toBeGreaterThan(0);

      const { pos, lt: lt2 } = backend.spkpos("EARTH", 0, "J2000", "NONE", "SUN");
      expect(pos).toHaveLength(3);
      expect(lt2).toBeGreaterThan(0);
    } finally {
      await dispose();
    }
  }, 60_000);
});
