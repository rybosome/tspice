import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createKernelStager } from "../src/runtime/kernel-staging.js";

describe("backend-node kernel staging", () => {
  it("resolvePath canonicalizes virtual kernel paths even when not staged", () => {
    const stager = createKernelStager();

    // Not staged, but still a recognized virtual path: return canonical `/kernels/...`.
    expect(stager.resolvePath("kernels/a.tm")).toBe("/kernels/a.tm");
    expect(stager.resolvePath("/kernels/a.tm")).toBe("/kernels/a.tm");
  });

  it("resolvePath leaves non-virtual paths unchanged", () => {
    const stager = createKernelStager();

    // Normal OS paths can contain `..` and should pass through untouched.
    expect(stager.resolvePath("../kernels/a.tm")).toBe("../kernels/a.tm");
  });

  it("resolvePathForSpice materializes py-parity virtual paths to deterministic OS temp paths", () => {
    const stager = createKernelStager();

    const first = stager.resolvePathForSpice("py-parity/scratch/generated/file.bds");
    const second = stager.resolvePathForSpice("py-parity/scratch/generated/file.bds");

    expect(path.isAbsolute(first)).toBe(true);
    expect(first).toBe(second);
    expect(fs.existsSync(path.dirname(first))).toBe(true);
  });

  it("unload reclaims staged non-py-parity temp file mappings", () => {
    const stager = createKernelStager();
    const native = {
      furnsh: vi.fn(),
      unload: vi.fn(),
      kclear: vi.fn(),
    };

    const virtualPath = "/kernels/frames-staged.bc";
    stager.furnsh(
      {
        path: virtualPath,
        bytes: new Uint8Array([9, 8, 7, 6]),
      },
      native as any,
    );

    const stagedPath = stager.resolvePathForSpice(virtualPath);
    expect(fs.existsSync(stagedPath)).toBe(true);

    stager.unload(virtualPath, native as any);

    expect(native.unload).toHaveBeenCalledTimes(1);
    expect(native.unload).toHaveBeenCalledWith(stagedPath);
    expect(fs.existsSync(stagedPath)).toBe(false);
    expect(stager.resolvePathForSpice(virtualPath)).toBe(virtualPath);
    expect(stager.virtualizePathFromSpice(stagedPath)).toBe(stagedPath);

    stager.kclear(native as any);
  });

  it("keeps byte-staged py-parity file mapping after unload", () => {
    const stager = createKernelStager();
    const native = {
      furnsh: vi.fn(),
      unload: vi.fn(),
      kclear: vi.fn(),
    };

    stager.furnsh(
      {
        path: "py-parity/kernels/frames-staged.bc",
        bytes: new Uint8Array([1, 2, 3, 4]),
      },
      native as any,
    );

    const stagedPath = stager.resolvePathForSpice("py-parity/kernels/frames-staged.bc");

    stager.unload("py-parity/kernels/frames-staged.bc", native as any);

    expect(native.unload).toHaveBeenCalledTimes(1);
    expect(native.unload).toHaveBeenCalledWith(stagedPath);

    // Mapping and file remain available for non-kernel file APIs.
    expect(stager.resolvePathForSpice("py-parity/kernels/frames-staged.bc")).toBe(stagedPath);
    expect(fs.existsSync(stagedPath)).toBe(true);

    // Re-unload should be a no-op for an already-unloaded virtual kernel.
    stager.unload("py-parity/kernels/frames-staged.bc", native as any);
    expect(native.unload).toHaveBeenCalledTimes(1);

    stager.kclear(native as any);
  });
});
