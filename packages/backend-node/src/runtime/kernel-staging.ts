import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { KernelSource } from "@rybosome/tspice-backend-contract";

import type { NativeAddon } from "./addon.js";

export type KernelStager = {
  furnsh(kernel: KernelSource, native: NativeAddon): void;
  unload(path: string, native: NativeAddon): void;
  kclear(native: NativeAddon): void;
};

export function createKernelStager(): KernelStager {
  const tempByVirtualPath = new Map<string, string>();
  let tempKernelRootDir: string | undefined;

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

  return {
    furnsh: (_kernel, native) => {
      const kernel = _kernel;
      if (typeof kernel === "string") {
        native.furnsh(kernel);
        return;
      }

      // For byte-backed kernels, we write to a temp file and load via CSPICE.
      // We then remember the resolved temp path so `unload(kernel.path)` unloads
      // the correct file.
      const existingTemp = tempByVirtualPath.get(kernel.path);
      if (existingTemp) {
        native.unload(existingTemp);
        tempByVirtualPath.delete(kernel.path);
        safeUnlink(existingTemp);
      }

      const rootDir = ensureTempKernelRootDir();
      const fileName = path.basename(kernel.path) || "kernel";
      const tempPath = path.join(rootDir, `${randomUUID()}-${fileName}`);
      fs.writeFileSync(tempPath, kernel.bytes);

      try {
        native.furnsh(tempPath);
      } catch (error) {
        safeUnlink(tempPath);
        throw error;
      }

      tempByVirtualPath.set(kernel.path, tempPath);
    },

    unload: (_path, native) => {
      const resolved = tempByVirtualPath.get(_path);
      if (resolved) {
        native.unload(resolved);
        tempByVirtualPath.delete(_path);
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
  };
}
