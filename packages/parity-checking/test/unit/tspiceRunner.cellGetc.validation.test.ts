import { describe, expect, it } from "vitest";

import { createTspiceRunner } from "../../src/runners/tspiceRunner.js";
import type { RunCaseInputV2 } from "../../src/runners/types.js";

function createCellGetcInput(args: unknown[]): RunCaseInputV2 {
  return {
    schemaVersion: 2,
    manifest: {
      id: "methods/cells-windows/cellGetc@v2",
      kind: "method",
    },
    contract: {
      contractMethod: "cells-windows.cellGetc",
      canonicalMethod: "cells-windows.cellGetc",
      aliases: [],
      result: { const: "c" },
      errors: [{ code: "invalid_args" }, { code: "spice_error" }],
    },
    args,
    workflow: {
      steps: [{ op: "invokeLegacyCall" }],
    },
  };
}

describe("tspiceRunner cellGetc validation", () => {
  it("returns cspice-compatible message for invalid char recipe tuple", async () => {
    const tspice = await createTspiceRunner();

    try {
      const out = await tspice.runCase(createCellGetcInput([["char", 8, 0], 0]));

      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.error.code).toBe("invalid_args");
        expect(out.error.message).toBe("cells-windows.cellGetc expects args[0] to be a char recipe tuple");
      }
    } finally {
      await tspice.dispose?.();
    }
  });

  it("returns cspice-compatible message for non-char recipe kind", async () => {
    const tspice = await createTspiceRunner();

    try {
      const out = await tspice.runCase(createCellGetcInput([["int", 8], 0]));

      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.error.code).toBe("invalid_args");
        expect(out.error.message).toBe("cells-windows.cellGetc expects args[0] to be [\"char\",size,length]");
      }
    } finally {
      await tspice.dispose?.();
    }
  });
});
