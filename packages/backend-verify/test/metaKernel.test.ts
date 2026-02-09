import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolveMetaKernelKernelsToLoad,
  sanitizeMetaKernelTextForNative,
  sanitizeMetaKernelTextForWasm,
} from "../src/kernels/metaKernel.js";

describe("sanitizeMetaKernelTextForWasm", () => {
  it("preserves begintext blocks and removes KERNELS_TO_LOAD assignments in begindata", () => {
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

    // Begintext/commentary should remain untouched.
    expect(out).toMatch(/should-not-parse\.bsp/);
    expect(out).toMatch(/trailing commentary/);

    // Pool assignments should remain.
    expect(out).toMatch(/PATH_VALUES/);
    expect(out).toMatch(/PATH_SYMBOLS/);

    // KERNELS_TO_LOAD in the data section should be removed.
    expect(out).not.toMatch(/\$PACK\/a\.bsp/);
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

describe("sanitizeMetaKernelTextForNative", () => {
  it("rewrites relative PATH_VALUES and KERNELS_TO_LOAD entries to be cwd-independent", () => {
    const input = [
      "KPL/MK",
      "",
      "\\begintext",
      "  PATH_VALUES = ( 'should-not-parse' )",
      "\\begindata",
      "  PATH_VALUES  = ( '.' '../rel' '/abs' )",
      "  KERNELS_TO_LOAD = ( '$PACK/a.bsp' 'b.bsp' '../c.bsp' '/d.bsp' )",
      "",
    ].join("\n");

    const out = sanitizeMetaKernelTextForNative(input, "/pack/dir");

    // begintext blocks should be stripped.
    expect(out).not.toContain("should-not-parse");

    // PATH_VALUES should be fully qualified.
    expect(out).toContain(`'/pack/dir'`);
    expect(out).toContain(`'/pack/rel'`);
    expect(out).toContain(`'/abs'`);

    // KERNELS_TO_LOAD should be fully qualified (except for symbol expansions).
    expect(out).toContain("'$PACK/a.bsp'");
    expect(out).toContain(`'/pack/dir/b.bsp'`);
    expect(out).toContain(`'/pack/c.bsp'`);
    expect(out).toContain(`'/d.bsp'`);
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
