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
   * If `path` matches a previously byte-staged kernel, returns the resolved OS
   * temp-file path. Otherwise returns `path` unchanged.
   */
  resolvePath(path: string): string;
};

export function createKernelStager(): KernelStager {
  const tempByVirtualPath = new Map<string, string>();
  let tempKernelRootDir: string | undefined;

  /**
   * Canonicalize a virtual kernel identifier to the shared `/kernels/...` form.
   *
   * This is intentionally strict (no `..`) to keep byte-backed kernel staging
   * safe and consistent with the WASM backend.
   */
  function canonicalVirtualKernelPath(input: string): string {
    return `/kernels/${normalizeVirtualKernelPath(input)}`;
  }

  function tryCanonicalVirtualKernelPath(input: string): string | undefined {
    // `normalizeVirtualKernelPath()` is intentionally strict (no `..`), but it
    // can still successfully normalize *absolute* OS paths like
    // `/home/user/foo.tm`. Those must pass through unchanged.
    //
    // For relative paths (e.g. `naif0012.tls`), we keep treating them as
    // virtual kernel identifiers so byte-backed kernels can be loaded/unloaded
    // consistently.
    if (input.startsWith("/") && !input.startsWith("/kernels/")) {
      return undefined;
    }
    try {
      return canonicalVirtualKernelPath(input);
    } catch {
      // This may be a normal OS path (which can include `..`). Only treat it as
      // virtual if it normalizes successfully.
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

  function resolvePath(input: string): string {
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
        native.furnsh(resolvePath(kernel));
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
    },

    unload: (_path, native) => {
      const canonical = tryCanonicalVirtualKernelPath(_path);
      const resolved = canonical ? tempByVirtualPath.get(canonical) : undefined;
      if (resolved) {
        native.unload(resolved);
        tempByVirtualPath.delete(canonical!);
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
    },

    resolvePath,
  };
}
