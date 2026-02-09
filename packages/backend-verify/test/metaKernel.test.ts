import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolveMetaKernelKernelsToLoad,
  sanitizeMetaKernelTextForWasm,
} from "../src/kernels/metaKernel.js";

describe("sanitizeMetaKernelTextForWasm", () => {
  it("strips begintext blocks and removes KERNELS_TO_LOAD assignments in begindata", () => {
    const input = [
      "KPL/MK",
      "",
      "\\begintext",
      "  KERNELS_TO_LOAD = ( 'should-not-parse.bsp' )",
      "\\begindata",
      "  PATH_VALUES  = ( '.' )",
      "  PATH_SYMBOLS = ( 'PACK' )",
      "  KERNELS_TO_LOAD = (",
      "     '$PACK/a.bsp'",
      "  )",
      "",
      "\\begintext",
      "  trailing commentary",
      "",
    ].join("\n");

    const out = sanitizeMetaKernelTextForWasm(input);

    // The begintext region should be removed entirely.
    expect(out).not.toMatch(/should-not-parse\\.bsp/);
    expect(out).not.toMatch(/trailing commentary/);

    // Pool assignments should remain.
    expect(out).toMatch(/PATH_VALUES/);
    expect(out).toMatch(/PATH_SYMBOLS/);

    // KERNELS_TO_LOAD should be removed.
    expect(out).not.toContain("KERNELS_TO_LOAD");
    expect(out).not.toMatch(/\\$PACK\\/a\\.bsp/);
  });

  it("only sanitizes within begindata when present", () => {
    const input = [
      "KPL/MK",
      "KERNELS_TO_LOAD = ( 'ignored' )",
      "\\begindata",
      "KERNELS_TO_LOAD = ( 'x.bsp' )",
      "",
    ].join("\n");

    const out = sanitizeMetaKernelTextForWasm(input);

    // Header text should remain untouched.
    expect(out).toContain("KERNELS_TO_LOAD = ( 'ignored' )");

    // Data section should be removed.
    expect(out).not.toContain("x.bsp");
  });
});

describe("resolveMetaKernelKernelsToLoad", () => {
  it("throws when KERNELS_TO_LOAD is present but parses empty", () => {
    const input = [
      "KPL/MK",
      "\\begindata",
      "KERNELS_TO_LOAD = ( )",
      "",
    ].join("\n");

    expect(() =>
      resolveMetaKernelKernelsToLoad(input, "/abs/path/to/meta.tm"),
    ).toThrow(/KERNELS_TO_LOAD assignment but no kernel entries were parsed/i);
  });

  it("throws when KERNELS_TO_LOAD contains no quoted entries", () => {
    const input = [
      "KPL/MK",
      "\\begindata",
      "KERNELS_TO_LOAD = ( unquoted-kernel.bsp )",
      "",
    ].join("\n");

    expect(() =>
      resolveMetaKernelKernelsToLoad(input, "/abs/path/to/meta.tm"),
    ).toThrow(/KERNELS_TO_LOAD assignment but no kernel entries were parsed/i);
  });

  it("enforces restrictToDir even when a kernel path is explicitly absolute", () => {
    const input = [
      "KPL/MK",
      "\\begindata",
      "KERNELS_TO_LOAD = ( '/outside/kernel.bsp' )",
      "",
    ].join("\n");

    expect(() =>
      resolveMetaKernelKernelsToLoad(input, "/pack/pack.tm", { restrictToDir: "/pack" }),
    ).toThrow(/outside of the allowed directory/i);
  });

  it("allows explicitly absolute kernel paths that remain within restrictToDir", () => {
    const input = [
      "KPL/MK",
      "\\begindata",
      "KERNELS_TO_LOAD = ( '/pack/a/kernel.bsp' )",
      "",
    ].join("\n");

    const out = resolveMetaKernelKernelsToLoad(input, "/pack/pack.tm", { restrictToDir: "/pack" });
    expect(out).toEqual([path.resolve("/pack/a/kernel.bsp")]);
  });

  it("blocks symlink-based escapes when restrictToDir is set", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-mk-"));

    const packDir = path.join(tmp, "pack");
    const outsideDir = path.join(tmp, "outside");
    fs.mkdirSync(packDir, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });

    const outsideKernel = path.join(outsideDir, "outside.bsp");
    fs.writeFileSync(outsideKernel, "x", "utf8");

    const linkDir = path.join(packDir, "link");
    fs.symlinkSync(outsideDir, linkDir, process.platform === "win32" ? "junction" : "dir");

    const metaKernelPath = path.join(packDir, "pack.tm");
    const input = [
      "KPL/MK",
      "\\begindata",
      "PATH_VALUES = ( '.' )",
      "PATH_SYMBOLS = ( 'PACK' )",
      "KERNELS_TO_LOAD = ( '$PACK/link/outside.bsp' )",
      "",
    ].join("\n");

    expect(() =>
      resolveMetaKernelKernelsToLoad(input, metaKernelPath, { restrictToDir: packDir }),
    ).toThrow(/outside of the allowed directory/i);
  });
});
