import { describe, expect, it } from "vitest";

import { sanitizeMetaKernelTextForWasm } from "../src/kernels/metaKernel.js";

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
    expect(out).not.toMatch(/should-not-parse\.bsp/);
    expect(out).not.toMatch(/trailing commentary/);

    // Pool assignments should remain.
    expect(out).toMatch(/PATH_VALUES/);
    expect(out).toMatch(/PATH_SYMBOLS/);

    // KERNELS_TO_LOAD should be removed.
    expect(out).not.toContain("KERNELS_TO_LOAD");
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
