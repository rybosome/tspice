import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { KernelSource } from "@rybosome/tspice-backend-contract";
import { normalizeVirtualKernelPath } from "@rybosome/tspice-core";

import type { NativeAddon } from "./addon.js";

export type KernelStager = {
  furnsh(kernel: KernelSource, native: NativeAddon): void;
  unload(path: string, native: NativeAddon): void;
  kclear(native: NativeAddon): void;

  /**
   * If `path` matches a byte-staged kernel, returns the resolved OS temp-file
   * path. Otherwise returns a canonicalized virtual kernel identifier (or the
   * original OS path).
   */
  resolvePath(path: string): string;

  /**
   * Map an input path to the path string CSPICE expects.
   *
   * - OS paths pass through unchanged.
   * - virtual kernel ids canonicalize to `/kernels/...` and, if byte-staged,
   *   resolve to a temp path.
   */
  resolvePathForSpice(path: string): string;

  /** Map a staged temp path back to its virtual id (or passthrough). */
  virtualizePathFromSpice(path: string): string;
};

export function createKernelStager(): KernelStager {
  const tempByVirtualPath = new Map<string, string>();
  const virtualByTempPath = new Map<string, string>();
  let tempKernelRootDir: string | undefined;

  const VIRTUAL_KERNEL_ROOT = "/kernels/";

  /**
   * Canonicalize a virtual kernel identifier to the shared `/kernels/...` form.
   *
   * This is intentionally strict (no `..`) to keep byte-backed kernel staging
   * safe and consistent with the WASM backend.
   */
  function canonicalVirtualKernelPath(input: string): string {
    return `/kernels/${normalizeVirtualKernelPath(input)}`;
  }

  function isVirtualKernelId(input: string): boolean {
    // Virtual kernel identifiers are explicit and POSIX-style.
    //
    // We *do not* treat arbitrary relative OS paths as virtual identifiers,
    // since that would be surprising for Node consumers (e.g. `./naif0012.tls`).
    return input.startsWith(VIRTUAL_KERNEL_ROOT) || input.startsWith("kernels/");
  }

  function tryCanonicalVirtualKernelPath(input: string): string | undefined {
    // Treat absolute OS paths as OS paths unless the caller explicitly opted
    // into the virtual namespace.
    if (path.isAbsolute(input) && !input.startsWith(VIRTUAL_KERNEL_ROOT)) {
      return undefined;
    }

    // If this is a real on-disk absolute path, treat it as an OS path.
    //
    // This matters on POSIX because `/kernels/...` is a valid absolute path and
    // could exist on disk; we only want to treat it as a virtual identifier
    // when it doesn't resolve to a real file.
    if (path.isAbsolute(input) && fs.existsSync(input)) {
      return undefined;
    }

    // `normalizeVirtualKernelPath()` is intentionally strict (no `..`), but it
    // can still successfully normalize *absolute* OS paths like `/home/user/foo.tm`.
    // Those must pass through unchanged.
    if (!isVirtualKernelId(input)) {
      return undefined;
    }

    try {
      return canonicalVirtualKernelPath(input);
    } catch {
      // Only treat as virtual if it normalizes successfully.
      return undefined;
    }
  }

  function ensureTempKernelRootDir(): string {
    if (tempKernelRootDir) {
      return tempKernelRootDir;
    }
    tempKernelRootDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-kernels-"));
    return tempKernelRootDir;
  }

  function safeUnlink(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      // Best-effort cleanup.
      if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  function resolvePathForSpice(input: string): string {
    const canonical = tryCanonicalVirtualKernelPath(input);
    if (!canonical) {
      return input;
    }

    // If this is a valid virtual kernel path but it's not staged, return the
    // canonical virtual identifier. This keeps the backend behavior stable
    // regardless of whether callers use `kernels/foo.tm`, `/kernels/foo.tm`,
    // or other equivalent virtual spellings.
    return tempByVirtualPath.get(canonical) ?? canonical;
  }

  return {
    furnsh: (_kernel, native) => {
      const kernel = _kernel;
      if (typeof kernel === "string") {
        native.furnsh(resolvePathForSpice(kernel));
        return;
      }

      const virtualPath = canonicalVirtualKernelPath(kernel.path);

      // For byte-backed kernels, we write to a temp file and load via CSPICE.
      // We then remember the resolved temp path so `unload(kernel.path)` unloads
      // the correct file.
      const existingTemp = tempByVirtualPath.get(virtualPath);
      if (existingTemp) {
        native.unload(existingTemp);
        tempByVirtualPath.delete(virtualPath);
        virtualByTempPath.delete(existingTemp);
        safeUnlink(existingTemp);
      }

      const rootDir = ensureTempKernelRootDir();
      const fileName = path.basename(virtualPath) || "kernel";
      const tempPath = path.join(rootDir, `${randomUUID()}-${fileName}`);
      fs.writeFileSync(tempPath, kernel.bytes);

      try {
        native.furnsh(tempPath);
      } catch (error) {
        safeUnlink(tempPath);
        throw error;
      }

      tempByVirtualPath.set(virtualPath, tempPath);
      virtualByTempPath.set(tempPath, virtualPath);
    },

    unload: (_path, native) => {
      const canonical = tryCanonicalVirtualKernelPath(_path);
      const resolved = canonical ? tempByVirtualPath.get(canonical) : undefined;
      if (resolved) {
        native.unload(resolved);
        tempByVirtualPath.delete(canonical!);
        virtualByTempPath.delete(resolved);
        safeUnlink(resolved);
        return;
      }

      native.unload(_path);
    },

    kclear: (native) => {
      native.kclear();

      // Clear any byte-backed kernels we staged to temp files.
      for (const tempPath of tempByVirtualPath.values()) {
        safeUnlink(tempPath);
      }
      tempByVirtualPath.clear();
      virtualByTempPath.clear();
    },

    resolvePath: resolvePathForSpice,
    resolvePathForSpice,

    virtualizePathFromSpice: (p) => virtualByTempPath.get(p) ?? p,
  };
}
