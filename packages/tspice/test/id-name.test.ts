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

describe("Stage 2: IDs / names", () => {
  const itNode = it.runIf(nodeBackendAvailable && process.arch !== "arm64");

  itNode("node backend: bodn2c/bodc2n/namfrm/frmnam/cidfrm/cnmfrm", async () => {
    const backend = await createBackend({ backend: "node" });
    const pck = await ensureKernelFile(PCK);

    backend.kclear();
    backend.furnsh(lskPath);
    backend.furnsh(pck.path);

    const earth = backend.bodn2c("EARTH");
    expect(earth.found).toBe(true);
    if (earth.found) {
      expect(earth.code).toBe(399);
    }

    const notABody = backend.bodn2c("NOT_A_BODY");
    expect(notABody.found).toBe(false);

    const earthName = backend.bodc2n(399);
    expect(earthName.found).toBe(true);
    if (earthName.found) {
      expect(earthName.name).toContain("EARTH");
    }

    const j2000 = backend.namfrm("J2000");
    expect(j2000.found).toBe(true);
    if (j2000.found) {
      expect(j2000.code).toBe(1);
    }

    const j2000Name = backend.frmnam(1);
    expect(j2000Name.found).toBe(true);
    if (j2000Name.found) {
      expect(j2000Name.name).toBe("J2000");
    }

    const earthFrame = backend.cidfrm(399);
    expect(earthFrame.found).toBe(true);
    if (earthFrame.found) {
      expect(earthFrame.frname).toContain("IAU_EARTH");
    }

    const earthFrame2 = backend.cnmfrm("EARTH");
    expect(earthFrame2.found).toBe(true);
    if (earthFrame2.found) {
      expect(earthFrame2.frname).toContain("IAU_EARTH");
    }
  });

  it("wasm backend: bodn2c/bodc2n/namfrm/frmnam/cidfrm/cnmfrm", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const pck = await ensureKernelFile(PCK);
    const lskBytes = fs.readFileSync(lskPath);

    backend.kclear();
    backend.loadKernel("naif0012.tls", lskBytes);
    backend.loadKernel(PCK.name, pck.bytes);

    const earth = backend.bodn2c("EARTH");
    expect(earth.found).toBe(true);
    if (earth.found) {
      expect(earth.code).toBe(399);
    }

    const notABody = backend.bodn2c("NOT_A_BODY");
    expect(notABody.found).toBe(false);

    const earthName = backend.bodc2n(399);
    expect(earthName.found).toBe(true);
    if (earthName.found) {
      expect(earthName.name).toContain("EARTH");
    }

    const j2000 = backend.namfrm("J2000");
    expect(j2000.found).toBe(true);
    if (j2000.found) {
      expect(j2000.code).toBe(1);
    }

    const j2000Name = backend.frmnam(1);
    expect(j2000Name.found).toBe(true);
    if (j2000Name.found) {
      expect(j2000Name.name).toBe("J2000");
    }

    const earthFrame = backend.cidfrm(399);
    expect(earthFrame.found).toBe(true);
    if (earthFrame.found) {
      expect(earthFrame.frname).toContain("IAU_EARTH");
    }

    const earthFrame2 = backend.cnmfrm("EARTH");
    expect(earthFrame2.found).toBe(true);
    if (earthFrame2.found) {
      expect(earthFrame2.frname).toContain("IAU_EARTH");
    }
  });
});
