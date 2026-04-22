import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import type { Spice } from "@rybosome/tspice";

import type { ParityCase } from "../src/case-types.js";
import { runCaseInTspice } from "../src/run-tspice.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.resolve(__dirname, "..", "fixtures");

describe("runCaseInTspice", () => {
  it("cleans up scratch context when workflow normalization throws", () => {
    const caseId = `normalization-cleanup-${Date.now()}`;
    const scratchPrefix = `py-parity-${caseId}-`;

    const before = fs
      .readdirSync(os.tmpdir(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(scratchPrefix));
    expect(before).toHaveLength(0);

    const kclear = vi.fn();
    const reset = vi.fn();
    const spice = {
      raw: {
        kclear,
        reset,
      },
    } as unknown as Spice;

    const parityCase: ParityCase = {
      caseId,
      description: "normalization failure should still clean up runtime context",
      expectation: { kind: "error" },
      workflow: [
        {
          op: "kernels.kinfo",
          path: "kernels/naif0012.tls",
          alias: "missing-alias",
        },
      ],
    };

    const result = runCaseInTspice(spice, parityCase, fixturesRoot);

    expect(result).toEqual({
      caseId,
      ok: false,
      outputs: [],
      error: {
        type: "Error",
        message: "Workflow alias not found: missing-alias",
      },
    });
    expect(kclear).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenCalledTimes(2);

    const after = fs
      .readdirSync(os.tmpdir(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(scratchPrefix));
    expect(after).toHaveLength(0);
  });
});
