import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";
import type { DlaDescriptor, SpiceHandle } from "@rybosome/tspice-backend-contract";
import { loadTestKernels } from "../../tspice/test/test-kernels.js";

describe("@rybosome/tspice-backend-wasm file-io", () => {
  it("can create and close a DLA file in the emscripten FS", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/create-close.dla";
    const handle = backend.dlaopn(path, "DLA", "TSPICE", 0);
    expect(backend.dlabfs(handle)).toEqual({ found: false });
    backend.dlacls(handle);

    expect(backend.exists(path)).toBe(true);
  });

  it("throws on double-close", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/double-close.dla";
    const handle = backend.dlaopn(path, "DLA", "TSPICE", 0);
    backend.dlacls(handle);
    expect(() => backend.dlacls(handle)).toThrow(/invalid|closed/i);
  });

  it("throws on invalid handle usage", async () => {
    const backend = await createWasmBackend();

    expect(() => backend.dafcls(123 as unknown as SpiceHandle)).toThrow(/invalid|closed/i);

    const path = "file-io/kind-mismatch.dla";
    const dlaHandle = backend.dlaopn(path, "DLA", "TSPICE", 0);
    backend.dlacls(dlaHandle);

    const dasHandle = backend.dasopr(path);
    expect(() => backend.dafbfs(dasHandle as unknown as SpiceHandle)).toThrow(/DAF/i);
    backend.dascls(dasHandle);
  });

  it("dascls can close a handle opened by dlaopn", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/dascls-dlaopn-close.dla";
    const handle = backend.dlaopn(path, "DLA", "TSPICE", 0);
    backend.dascls(handle);

    expect(backend.exists(path)).toBe(true);
  });

  it("dlacls can close a handle opened by dasopr on a DLA file", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/dlacls-dasopr-close.dla";
    const dlaHandle = backend.dlaopn(path, "DLA", "TSPICE", 0);
    backend.dlacls(dlaHandle);

    const dasHandle = backend.dasopr(path);
    backend.dlacls(dasHandle);

    expect(backend.exists(path)).toBe(true);
  });

  it("dlabfs accepts a DAS handle opened by dasopr on a DLA file", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/dlabfs-dasopr.dla";
    const dlaHandle = backend.dlaopn(path, "DLA", "TSPICE", 0);
    backend.dlacls(dlaHandle);

    const dasHandle = backend.dasopr(path);
    expect(backend.dlabfs(dasHandle)).toEqual({ found: false });
    backend.dascls(dasHandle);
  });

  it("can traverse DLA segments in a DSK via dlafns", async () => {
    const backend = await createWasmBackend();

    const { dsk } = await loadTestKernels();
    const dskKernel = {
      path: "apophis_g_25000mm_rad_obj_0000n00000_v001.bds",
      bytes: dsk,
    };

    // Ensure the bytes exist on the emscripten FS.
    backend.furnsh(dskKernel);

    const handle = backend.dasopr(dskKernel.path);
    try {
      let next = backend.dlabfs(handle);
      let count = 0;
      while (next.found) {
        count++;
        if (count > 10_000) {
          throw new Error("DLA segment traversal did not terminate");
        }
        next = backend.dlafns(handle, next.descr);
      }

      expect(count).toBeGreaterThanOrEqual(1);
    } finally {
      // Close via the DAS-backed close path (DSKs are DLA files).
      backend.dascls(handle);
      backend.unload(dskKernel.path);
    }
  });

  it("validates dlafns(descr)", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/dlafns-descr-validation.dla";
    const handle = backend.dlaopn(path, "DLA", "TSPICE", 0);

    const badDescr: DlaDescriptor = {
      bwdptr: 0,
      fwdptr: 0,
      ibase: 0,
      isize: 0,
      dbase: 0,
      dsize: 0,
      cbase: 0,
      // int32 max + 1
      csize: 2147483648,
    };

    expect(() => backend.dlafns(handle, badDescr)).toThrow(/32-bit|int32/i);
    backend.dlacls(handle);
  });

  it("rejects negative dlafns(descr) fields", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/dlafns-descr-negative-validation.dla";
    const handle = backend.dlaopn(path, "DLA", "TSPICE", 0);

    const badDescr: DlaDescriptor = {
      bwdptr: 0,
      fwdptr: 0,
      ibase: -1,
      isize: 0,
      dbase: 0,
      dsize: 0,
      cbase: 0,
      csize: 0,
    };

    expect(() => backend.dlafns(handle, badDescr)).toThrow(/ibase.*>=\s*0/i);
    backend.dlacls(handle);
  });

  it("can write and roundtrip a minimal type 2 DSK in the emscripten FS", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/roundtrip.bds";

    const nv = 3;
    const vrtces = [
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ];
    const np = 1;
    const plates = [1, 2, 3];

    const handle = backend.dskopn(path, "TSPICE", 0);
    try {
      const { spaixd, spaixi } = backend.dskmi2(
        nv,
        vrtces,
        np,
        plates,
        0.2, // finscl
        5.0, // corscl
        100_000, // worksz
        5_000, // voxpsz
        5_000, // voxlsz
        true, // makvtl
        200_000, // spxisz (must exceed SPICE_DSK02_IXIFIX + overhead)
      );

      backend.dskw02(
        handle,
        399, // center (Earth)
        1, // surfid
        2, // dclass = SPICE_DSK_GENCLS
        "J2000",
        3, // corsys = SPICE_DSK_RECSYS
        new Array(10).fill(0),
        0,
        1,
        0,
        1,
        -0.1,
        0.1,
        0,
        1,
        nv,
        vrtces,
        np,
        plates,
        spaixd,
        spaixi,
      );
    } finally {
      backend.dascls(handle);
    }

    expect(backend.exists(path)).toBe(true);
    expect(backend.getfat(path).type).toBe("DSK");

    const readHandle = backend.dasopr(path);
    try {
      const first = backend.dlabfs(readHandle);
      expect(first.found).toBe(true);
      if (!first.found) {
        throw new Error("Expected to find a DLA segment in the written DSK");
      }
      expect(backend.dlafns(readHandle, first.descr)).toEqual({ found: false });
    } finally {
      backend.dascls(readHandle);
    }
  });
});
