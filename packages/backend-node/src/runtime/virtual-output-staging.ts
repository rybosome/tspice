import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { VirtualOutput } from "@rybosome/tspice-backend-contract";
import { invariant, normalizeVirtualKernelPath } from "@rybosome/tspice-core";

export type VirtualOutputStager = {
  /** Resolve an output target (path or VirtualOutput) to an OS path for CSPICE. */
  resolvePathForSpice(target: string | VirtualOutput): string;

  /** Read bytes for a previously-created VirtualOutput. */
  readVirtualOutput(output: VirtualOutput): Uint8Array;

  /** Mark a VirtualOutput as currently being written by a native handle. */
  markOpen(output: VirtualOutput): void;

  /** Mark a VirtualOutput as closed/ready for reading. */
  markClosed(output: VirtualOutput): void;

  /** Best-effort cleanup for the temp output root (if created). */
  dispose(): void;
};

export function createVirtualOutputStager(): VirtualOutputStager {
  let tempRootDir: string | undefined;
  let exitHookInstalled = false;
  let disposed = false;

  const openOutputRefCount = new Map<string, number>();

  function ensureNotDisposed(context: string): void {
    invariant(!disposed, `${context}: VirtualOutputStager has been disposed`);
  }

  function cleanupTempRoot(): void {
    if (!tempRootDir) {
      return;
    }

    try {
      fs.rmSync(tempRootDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup.
    } finally {
      tempRootDir = undefined;
    }
  }

  function ensureTempRootDir(): string {
    ensureNotDisposed("ensureTempRootDir()");
    if (tempRootDir) {
      return tempRootDir;
    }
    tempRootDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-outputs-"));

    // Ensure we don't leak temp dirs in long-running processes where
    // the backend is created but not explicitly disposed.
    if (!exitHookInstalled) {
      exitHookInstalled = true;
      process.once("exit", () => {
        try {
          cleanupTempRoot();
        } catch {
          // Avoid throwing during process exit.
        }
      });
    }

    return tempRootDir;
  }

  function resolveVirtualOutputPath(virtualPath: string, context: string): string {
    const root = ensureTempRootDir();
    let rel: string;
    try {
      rel = normalizeVirtualKernelPath(virtualPath);
    } catch (error) {
      throw new Error(`${context}: invalid VirtualOutput.path ${JSON.stringify(virtualPath)}`, { cause: error });
    }

    // Harden against path traversal / absolute-path escapes (including Windows
    // drive-letter absolute paths).
    const abs = path.resolve(root, rel);
    const relative = path.relative(root, abs);
    invariant(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
      `${context}: VirtualOutput.path must resolve within the virtual output temp root`,
    );

    return abs;
  }

  return {
    resolvePathForSpice: (target) => {
      ensureNotDisposed("resolvePathForSpice(target)");
      if (typeof target === "string") {
        return target;
      }
      const outPath = resolveVirtualOutputPath(target.path, "resolvePathForSpice(target)");

      // Ensure parent directories exist so CSPICE can create the file.
      fs.mkdirSync(path.dirname(outPath), { recursive: true });

      return outPath;
    },

    readVirtualOutput: (output) => {
      ensureNotDisposed("readVirtualOutput(output)");
      const outPath = resolveVirtualOutputPath(output.path, "readVirtualOutput(output)");

      if ((openOutputRefCount.get(outPath) ?? 0) > 0) {
        throw new Error(
          `readVirtualOutput(): VirtualOutput ${JSON.stringify(output.path)} is still open. ` +
            "Close the writer handle first (e.g. spkcls(handle)) before reading bytes.",
        );
      }

      try {
        const buf = fs.readFileSync(outPath);
        // Return a plain Uint8Array (not a Node Buffer) per the backend contract.
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === "ENOENT") {
          throw new Error(
            `readVirtualOutput(): no staged file found for VirtualOutput path ${JSON.stringify(output.path)}. ` +
              "This can happen if the output was never created, or if the writer handle has not been closed yet (e.g. call spkcls(handle) before reading).",
            { cause: error },
          );
        }
        throw error;
      }
    },

    markOpen: (output) => {
      ensureNotDisposed("markOpen(output)");
      const outPath = resolveVirtualOutputPath(output.path, "markOpen(output)");
      openOutputRefCount.set(outPath, (openOutputRefCount.get(outPath) ?? 0) + 1);
    },

    markClosed: (output) => {
      ensureNotDisposed("markClosed(output)");
      const outPath = resolveVirtualOutputPath(output.path, "markClosed(output)");
      const next = (openOutputRefCount.get(outPath) ?? 0) - 1;
      if (next <= 0) {
        openOutputRefCount.delete(outPath);
      } else {
        openOutputRefCount.set(outPath, next);
      }
    },

    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      openOutputRefCount.clear();
      cleanupTempRoot();
    },
  } satisfies VirtualOutputStager;
}
