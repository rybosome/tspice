import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

import { ensureKernelFile } from "./helpers/kernels.js";

const PCK = {
  name: "pck00010.tpc",
  url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc",
  sha256: "59468328349aa730d18bf1f8d7e86efe6e40b75dfb921908f99321b3a7a701d2",
} as const;

describe("Phase 4: IDs / names", () => {
  const itNode = it.runIf(process.arch !== "arm64");

  itNode("node backend: bodn2c/bodc2n/namfrm/frmnam/cidfrm/cnmfrm", async () => {
    const backend = await createBackend({ backend: "node" });
    const pck = await ensureKernelFile(PCK);

    backend.kclear();
    backend.furnsh(pck.path);

    expect(backend.bodn2c("EARTH")).toEqual({ found: true, code: 399 });
    expect(backend.bodc2n(399)).toEqual({ found: true, name: "EARTH" });

    expect(backend.namfrm("J2000")).toEqual({ found: true, code: 1 });
    expect(backend.frmnam(1)).toEqual({ found: true, name: "J2000" });

    expect(backend.namfrm("DOES_NOT_EXIST")).toEqual({ found: false });
    expect(backend.frmnam(0)).toEqual({ found: false });

    const iauEarth = backend.namfrm("IAU_EARTH");
    expect(iauEarth.found).toBe(true);
    if (!iauEarth.found) {
      throw new Error("Expected IAU_EARTH to be mapped by namfrm");
    }

    expect(backend.cidfrm(399)).toEqual({ found: true, frcode: iauEarth.code, frname: "IAU_EARTH" });
    expect(backend.cnmfrm("EARTH")).toEqual({ found: true, frcode: iauEarth.code, frname: "IAU_EARTH" });

    expect(backend.cidfrm(-12345)).toEqual({ found: false });
    expect(backend.cnmfrm("DOES_NOT_EXIST")).toEqual({ found: false });
  });

  it("wasm backend: bodn2c/bodc2n/namfrm/frmnam/cidfrm/cnmfrm", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const pck = await ensureKernelFile(PCK);

    backend.kclear();
    backend.loadKernel(PCK.name, pck.bytes);

    expect(backend.bodn2c("EARTH")).toEqual({ found: true, code: 399 });
    expect(backend.bodc2n(399)).toEqual({ found: true, name: "EARTH" });

    expect(backend.namfrm("J2000")).toEqual({ found: true, code: 1 });
    expect(backend.frmnam(1)).toEqual({ found: true, name: "J2000" });

    expect(backend.namfrm("DOES_NOT_EXIST")).toEqual({ found: false });
    expect(backend.frmnam(0)).toEqual({ found: false });

    const iauEarth = backend.namfrm("IAU_EARTH");
    expect(iauEarth.found).toBe(true);
    if (!iauEarth.found) {
      throw new Error("Expected IAU_EARTH to be mapped by namfrm");
    }

    expect(backend.cidfrm(399)).toEqual({ found: true, frcode: iauEarth.code, frname: "IAU_EARTH" });
    expect(backend.cnmfrm("EARTH")).toEqual({ found: true, frcode: iauEarth.code, frname: "IAU_EARTH" });

    expect(backend.cidfrm(-12345)).toEqual({ found: false });
    expect(backend.cnmfrm("DOES_NOT_EXIST")).toEqual({ found: false });
  });
});
