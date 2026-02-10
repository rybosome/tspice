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

describe("IDs / names", () => {
  const itNode = it.runIf(nodeBackendAvailable && process.arch !== "arm64");

  itNode("node backend: bodn2c/bodc2n/bodc2s/bods2c/boddef/bodfnd/bodvar + frame utils", async () => {
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

    // --- new Group 6 routines ---

    const earthName2 = backend.bodc2s(399);
    expect(earthName2.toUpperCase()).toContain("EARTH");

    const earthFromNumeric = backend.bods2c("399");
    expect(earthFromNumeric.found).toBe(true);
    if (earthFromNumeric.found) {
      expect(earthFromNumeric.code).toBe(399);
    }

    const earthFromName = backend.bods2c("EARTH");
    expect(earthFromName.found).toBe(true);
    if (earthFromName.found) {
      expect(earthFromName.code).toBe(399);
    }

    const testBodyName = "TSPICE_TEST_BODY";
    const testBodyCode = 1_234_567_89;
    backend.boddef(testBodyName, testBodyCode);

    const testBodyResolved = backend.bods2c(testBodyName);
    expect(testBodyResolved.found).toBe(true);
    if (testBodyResolved.found) {
      expect(testBodyResolved.code).toBe(testBodyCode);
    }

    const testBodyName2 = backend.bodc2s(testBodyCode);
    expect(testBodyName2).toBe(testBodyName);

    expect(backend.bodfnd(399, "RADII")).toBe(true);
    const radii = backend.bodvar(399, "RADII");
    expect(radii).toHaveLength(3);

    // Item normalization: trim + ASCII-only uppercase.
    expect(backend.bodfnd(399, "  radii  ")).toBe(true);
    const radii2 = backend.bodvar(399, "  radii  ");
    expect(radii2).toHaveLength(3);

    expect(backend.bodfnd(399, "NOT_A_ITEM")).toBe(false);
    const missing = backend.bodvar(399, "NOT_A_ITEM");
    expect(missing).toEqual([]);

    const info = backend.frinfo(1);
    expect(info.found).toBe(true);
    if (info.found) {
      const roundTrip = backend.ccifrm(info.frameClass, info.classId);
      expect(roundTrip.found).toBe(true);
      if (roundTrip.found) {
        expect(roundTrip.frcode).toBe(1);
        expect(roundTrip.frname).toContain("J2000");
        expect(roundTrip.center).toBe(info.center);
      }
    }
  });

  it("wasm backend: bodn2c/bodc2n/bodc2s/bods2c/boddef/bodfnd/bodvar + frame utils", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const pck = await ensureKernelFile(PCK);
    const lskBytes = fs.readFileSync(lskPath);

    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });
    backend.furnsh({ path: `${PCK.name}`, bytes: pck.bytes });

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

    // --- new Group 6 routines ---

    const earthName2 = backend.bodc2s(399);
    expect(earthName2.toUpperCase()).toContain("EARTH");

    const earthFromNumeric = backend.bods2c("399");
    expect(earthFromNumeric.found).toBe(true);
    if (earthFromNumeric.found) {
      expect(earthFromNumeric.code).toBe(399);
    }

    const earthFromName = backend.bods2c("EARTH");
    expect(earthFromName.found).toBe(true);
    if (earthFromName.found) {
      expect(earthFromName.code).toBe(399);
    }

    const testBodyName = "TSPICE_TEST_BODY";
    const testBodyCode = 1_234_567_89;
    backend.boddef(testBodyName, testBodyCode);

    const testBodyResolved = backend.bods2c(testBodyName);
    expect(testBodyResolved.found).toBe(true);
    if (testBodyResolved.found) {
      expect(testBodyResolved.code).toBe(testBodyCode);
    }

    const testBodyName2 = backend.bodc2s(testBodyCode);
    expect(testBodyName2).toBe(testBodyName);

    expect(backend.bodfnd(399, "RADII")).toBe(true);
    const radii = backend.bodvar(399, "RADII");
    expect(radii).toHaveLength(3);

    // Item normalization: trim + ASCII-only uppercase.
    expect(backend.bodfnd(399, "  radii  ")).toBe(true);
    const radii2 = backend.bodvar(399, "  radii  ");
    expect(radii2).toHaveLength(3);

    expect(backend.bodfnd(399, "NOT_A_ITEM")).toBe(false);
    const missing = backend.bodvar(399, "NOT_A_ITEM");
    expect(missing).toEqual([]);

    const info = backend.frinfo(1);
    expect(info.found).toBe(true);
    if (info.found) {
      const roundTrip = backend.ccifrm(info.frameClass, info.classId);
      expect(roundTrip.found).toBe(true);
      if (roundTrip.found) {
        expect(roundTrip.frcode).toBe(1);
        expect(roundTrip.frname).toContain("J2000");
        expect(roundTrip.center).toBe(info.center);
      }
    }
  });
});
