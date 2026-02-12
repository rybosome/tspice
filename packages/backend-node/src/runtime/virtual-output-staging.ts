import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { VirtualOutput } from "@rybosome/tspice-backend-contract";
import { normalizeVirtualKernelPath } from "@rybosome/tspice-core";

export type VirtualOutputStager = {
  /** Resolve an output target (path or VirtualOutput) to an OS path for CSPICE. */
  resolvePathForSpice(target: string | VirtualOutput): string;

  /** Read bytes for a previously-created VirtualOutput. */
  readVirtualOutput(output: VirtualOutput): Uint8Array;
};

export function createVirtualOutputStager(): VirtualOutputStager {
  let tempRootDir: string | undefined;

  function ensureTempRootDir(): string {
    if (tempRootDir) {
      return tempRootDir;
    }
    tempRootDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-outputs-"));
    return tempRootDir;
  }

  function resolveVirtualOutputPath(virtualPath: string): string {
    const root = ensureTempRootDir();
    const rel = normalizeVirtualKernelPath(virtualPath);
    return path.join(root, rel);
  }

  return {
    resolvePathForSpice: (target) => {
      if (typeof target === "string") {
        return target;
      }
      const outPath = resolveVirtualOutputPath(target.path);

      // Ensure parent directories exist so CSPICE can create the file.
      fs.mkdirSync(path.dirname(outPath), { recursive: true });

      return outPath;
    },

    readVirtualOutput: (output) => {
      const outPath = resolveVirtualOutputPath(output.path);
      return fs.readFileSync(outPath);
    },
  } satisfies VirtualOutputStager;
}
