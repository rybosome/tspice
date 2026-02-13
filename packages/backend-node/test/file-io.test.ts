import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createNodeBackend } from "@rybosome/tspice-backend-node";
import type { DlaDescriptor, SpiceHandle } from "@rybosome/tspice-backend-contract";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
import { loadTestKernels } from "./test-kernels.js";

describe("@rybosome/tspice-backend-node file-io", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative("can open/search/close a DAF SPK", async () => {
    const backend = createNodeBackend();

    const { spk } = await loadTestKernels();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));

    try {
      const spkPath = path.join(tmpDir, "de405s.bsp");
      fs.writeFileSync(spkPath, spk);

      const handle = backend.dafopr(spkPath);
      backend.dafbfs(handle);
      expect(backend.daffna(handle)).toBe(true);
      backend.dafcls(handle);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  itNative("throws on double-close", async () => {
    const backend = createNodeBackend();

    const { spk } = await loadTestKernels();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));

    try {
      const spkPath = path.join(tmpDir, "de405s.bsp");
      fs.writeFileSync(spkPath, spk);

      const handle = backend.dafopr(spkPath);
      backend.dafcls(handle);
      expect(() => backend.dafcls(handle)).toThrow(/invalid|closed/i);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  itNative("throws on invalid handle usage", () => {
    const backend = createNodeBackend();

    expect(() => backend.dafcls(123 as unknown as SpiceHandle)).toThrow(/invalid|closed/i);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));

    try {
      const dlaPath = path.join(tmpDir, "test.dla");

      const dlaHandle = backend.dlaopn(dlaPath, "DLA", "TSPICE", 0);
      backend.dlacls(dlaHandle);

      const dasHandle = backend.dasopr(dlaPath);
      expect(() => backend.dafbfs(dasHandle as unknown as SpiceHandle)).toThrow(/DAF/i);
      backend.dascls(dasHandle);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  itNative("can create and close a DLA file", () => {
    const backend = createNodeBackend();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));

    try {
      const dlaPath = path.join(tmpDir, "create-close.dla");

      const handle = backend.dlaopn(dlaPath, "DLA", "TSPICE", 0);
      expect(backend.dlabfs(handle)).toEqual({ found: false });
      backend.dlacls(handle);

      expect(backend.exists(dlaPath)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  itNative("dascls can close a handle opened by dlaopn", () => {
    const backend = createNodeBackend();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));

    try {
      const dlaPath = path.join(tmpDir, "dascls-dlaopn-close.dla");
      const handle = backend.dlaopn(dlaPath, "DLA", "TSPICE", 0);
      backend.dascls(handle);
      expect(backend.exists(dlaPath)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  itNative("dlacls can close a handle opened by dasopr on a DLA file", () => {
    const backend = createNodeBackend();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));

    try {
      const dlaPath = path.join(tmpDir, "dlacls-dasopr-close.dla");

      const dlaHandle = backend.dlaopn(dlaPath, "DLA", "TSPICE", 0);
      backend.dlacls(dlaHandle);

      const dasHandle = backend.dasopr(dlaPath);
      backend.dlacls(dasHandle);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  itNative("dlabfs accepts a DAS handle opened by dasopr on a DLA file", () => {
    const backend = createNodeBackend();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));

    try {
      const dlaPath = path.join(tmpDir, "dlabfs-dasopr.dla");

      const dlaHandle = backend.dlaopn(dlaPath, "DLA", "TSPICE", 0);
      backend.dlacls(dlaHandle);

      const dasHandle = backend.dasopr(dlaPath);
      expect(backend.dlabfs(dasHandle)).toEqual({ found: false });
      backend.dascls(dasHandle);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  itNative("can traverse DLA segments in a DSK via dlafns", async () => {
    const backend = createNodeBackend();

    const { dsk } = await loadTestKernels();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));

    try {
      const dskPath = path.join(
        tmpDir,
        "apophis_g_25000mm_rad_obj_0000n00000_v001.bds",
      );
      fs.writeFileSync(dskPath, dsk);

      const handle = backend.dasopr(dskPath);
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
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  itNative("validates dlafns(descr)", () => {
    const backend = createNodeBackend();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));

    try {
      const dlaPath = path.join(tmpDir, "dlafns-descr-validation.dla");
      const handle = backend.dlaopn(dlaPath, "DLA", "TSPICE", 0);

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
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  itNative("rejects negative dlafns(descr) fields", () => {
    const backend = createNodeBackend();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));

    try {
      const dlaPath = path.join(tmpDir, "dlafns-descr-negative-validation.dla");
      const handle = backend.dlaopn(dlaPath, "DLA", "TSPICE", 0);

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
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  itNative("can write and roundtrip a minimal type 2 DSK", () => {
    const backend = createNodeBackend();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));

    try {
      const outPath = path.join(tmpDir, "roundtrip.bds");

      const nv = 3;
      const vrtces = [
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
      ];
      const np = 1;
      const plates = [1, 2, 3];

      const handle = backend.dskopn(outPath, "TSPICE", 0);
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

      expect(fs.existsSync(outPath)).toBe(true);
      expect(backend.getfat(outPath).type).toBe("DSK");

      const readHandle = backend.dasopr(outPath);
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
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
