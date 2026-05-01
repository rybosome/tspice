import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createCaseRuntimePaths,
  normalizePathRefRelativePath,
  removeScratchRootBestEffort,
  resolvePathRef,
  toPathRef,
  toVirtualKernelPath,
} from "../src/runtime/path-ref.js";

describe("runtime path refs", () => {
  it("coerces legacy string paths into fixture PathRef objects", () => {
    expect(toPathRef("kernels/naif0012.tls")).toEqual({
      kind: "fixture",
      rel: "kernels/naif0012.tls",
    });
  });

  it("resolves fixture and scratch refs under runtime roots", () => {
    const fixturesRoot = fs.mkdtempSync(path.join(os.tmpdir(), "py-parity-fixtures-"));
    const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "py-parity-scratch-"));

    try {
      expect(
        resolvePathRef(
          { fixturesRoot, scratchRoot },
          { kind: "fixture", rel: "kernels/naif0012.tls" },
        ),
      ).toBe(path.resolve(fixturesRoot, "kernels", "naif0012.tls"));

      expect(
        resolvePathRef(
          { fixturesRoot, scratchRoot },
          { kind: "scratch", rel: "tmp/generated.tls" },
        ),
      ).toBe(path.resolve(scratchRoot, "tmp", "generated.tls"));

      expect(toVirtualKernelPath({ kind: "fixture", rel: "kernels/naif0012.tls" })).toBe(
        "py-parity/kernels/naif0012.tls",
      );
      expect(toVirtualKernelPath({ kind: "scratch", rel: "tmp/generated.tls" })).toBe(
        "py-parity/scratch/tmp/generated.tls",
      );
    } finally {
      fs.rmSync(fixturesRoot, { recursive: true, force: true });
      fs.rmSync(scratchRoot, { recursive: true, force: true });
    }
  });

  it("rejects traversal attempts", () => {
    expect(() => normalizePathRefRelativePath("../escape.txt")).toThrow(/relative|escapes/i);
  });

  it("creates and disposes case-scoped scratch roots", () => {
    const runtimePaths = createCaseRuntimePaths(path.join(os.tmpdir(), "fixtures"), "Case 42/PathRef");

    const marker = path.join(runtimePaths.scratchRoot, "tmp", "marker.txt");
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, "ok", "utf8");

    expect(fs.existsSync(marker)).toBe(true);

    removeScratchRootBestEffort(runtimePaths.scratchRoot);
    expect(fs.existsSync(runtimePaths.scratchRoot)).toBe(false);
  });
});
