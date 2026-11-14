import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { NativeAddon } from "../src/runtime/addon.js";
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

    const first = stager.resolvePathForSpice(
      "py-parity/scratch/generated/file.bds",
    );
    const second = stager.resolvePathForSpice(
      "py-parity/scratch/generated/file.bds",
    );

    expect(path.isAbsolute(first)).toBe(true);
    expect(first).toBe(second);
    expect(fs.existsSync(path.dirname(first))).toBe(true);
  });

  it("retains staged files through duplicate loads and unloads until kclear", () => {
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

    stager.furnsh(virtualPath, native as any);
    expect(native.furnsh).toHaveBeenCalledTimes(2);
    expect(native.unload).not.toHaveBeenCalled();
    stager.unload(virtualPath, native as any);
    stager.unload(virtualPath, native as any);

    expect(native.unload).toHaveBeenCalledTimes(2);
    expect(native.unload).toHaveBeenCalledWith(stagedPath);
    expect(fs.existsSync(stagedPath)).toBe(true);
    expect(stager.resolvePathForSpice(virtualPath)).toBe(stagedPath);
    expect(stager.virtualizePathFromSpice(stagedPath)).toBe(virtualPath);

    stager.kclear(native as any);
    expect(fs.existsSync(stagedPath)).toBe(false);
    expect(stager.resolvePathForSpice(virtualPath)).toBe(virtualPath);
    expect(stager.virtualizePathFromSpice(stagedPath)).toBe(stagedPath);
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

    const stagedPath = stager.resolvePathForSpice(
      "py-parity/kernels/frames-staged.bc",
    );

    stager.unload("py-parity/kernels/frames-staged.bc", native as any);

    expect(native.unload).toHaveBeenCalledTimes(1);
    expect(native.unload).toHaveBeenCalledWith(stagedPath);

    // Mapping and file remain available for non-kernel file APIs.
    expect(
      stager.resolvePathForSpice("py-parity/kernels/frames-staged.bc"),
    ).toBe(stagedPath);
    expect(fs.existsSync(stagedPath)).toBe(true);

    // CSPICE owns registration counts; every unload reaches the toolkit.
    stager.unload("py-parity/kernels/frames-staged.bc", native as any);
    expect(native.unload).toHaveBeenCalledTimes(2);

    stager.kclear(native as any);
  });
  it("retains the file/mapping when CSPICE reports a partial load failure", () => {
    const stager = createKernelStager();
    const native = { furnsh: vi.fn(), unload: vi.fn(), kclear: vi.fn() };
    // Only the three staging operations are used by this filesystem fixture.
    const addon = native as NativeAddon;
    stager.furnsh({ path: "partial.tpc", bytes: new Uint8Array([1]) }, addon);
    const staged = stager.resolvePathForSpice("partial.tpc");
    native.furnsh.mockImplementationOnce(() => {
      throw new Error("partial load");
    });
    expect(() =>
      stager.furnsh({ path: "partial.tpc", bytes: new Uint8Array([2]) }, addon),
    ).toThrow("partial load");
    expect(native.unload).not.toHaveBeenCalled();
    expect(stager.resolvePathForSpice("partial.tpc")).toBe(staged);
    expect(fs.readFileSync(staged)).toEqual(Buffer.from([2]));
    expect(stager.virtualizePathFromSpice(staged)).toBe("/kernels/partial.tpc");
    stager.unload("partial.tpc", addon);
    expect(native.unload).toHaveBeenCalledWith(staged);
    expect(fs.existsSync(staged)).toBe(true);
    stager.kclear(addon);
    expect(fs.existsSync(staged)).toBe(false);
    expect(fs.existsSync(path.dirname(staged))).toBe(false);
  });
});
