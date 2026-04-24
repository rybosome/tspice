import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

/** Create a staging helper that maps virtual kernel IDs to OS temp files for the native backend. */
export function createKernelStager(): KernelStager {
  const tempByVirtualPath = new Map<string, string>();
  const virtualByTempPath = new Map<string, string>();
  const loadedVirtualPaths = new Set<string>();
  let tempKernelRootDir: string | undefined;

  const VIRTUAL_KERNEL_ROOT = "/kernels/";
  const PY_PARITY_VIRTUAL_ROOT = "py-parity/";

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
    return (
      input.startsWith(VIRTUAL_KERNEL_ROOT) ||
      input.startsWith("kernels/") ||
      input.startsWith(PY_PARITY_VIRTUAL_ROOT)
    );
  }

  function isPyParityCanonicalPath(canonical: string): boolean {
    return canonical.startsWith(`${VIRTUAL_KERNEL_ROOT}${PY_PARITY_VIRTUAL_ROOT}`);
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

    try {
      // Explicit virtual identifiers always participate.
      if (isVirtualKernelId(input)) {
        return canonicalVirtualKernelPath(input);
      }

      // For non-explicit relative paths, only treat as virtual if we already
      // staged bytes for that id. This preserves `unload("naif0012.tls")` for
      // byte-backed kernels without hijacking arbitrary on-disk relative paths.
      if (!path.isAbsolute(input)) {
        const canonical = canonicalVirtualKernelPath(input);
        return tempByVirtualPath.has(canonical) ? canonical : undefined;
      }

      return undefined;
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

  function createTempPathForVirtualPath(canonicalVirtualPath: string): string {
    const existing = tempByVirtualPath.get(canonicalVirtualPath);
    if (existing) {
      return existing;
    }

    const rootDir = ensureTempKernelRootDir();
    const rel = canonicalVirtualPath.startsWith(VIRTUAL_KERNEL_ROOT)
      ? canonicalVirtualPath.slice(VIRTUAL_KERNEL_ROOT.length)
      : canonicalVirtualPath.replace(/^\/+/, "");

    const tempPath = path.resolve(rootDir, rel);
    const relative = path.relative(rootDir, tempPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(
        `createTempPathForVirtualPath(): virtual path escaped temp root: ${JSON.stringify(canonicalVirtualPath)}`,
      );
    }

    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    tempByVirtualPath.set(canonicalVirtualPath, tempPath);
    virtualByTempPath.set(tempPath, canonicalVirtualPath);
    return tempPath;
  }

  function resolvePathForSpice(input: string): string {
    const canonical = tryCanonicalVirtualKernelPath(input);
    if (!canonical) {
      return input;
    }

    const staged = tempByVirtualPath.get(canonical);
    if (staged) {
      return staged;
    }

    // `py-parity/...` paths are backend-internal virtual identifiers used by
    // parity workflows. Materialize them to deterministic temp paths so native
    // file APIs (file-io/frames/dsk) can open/read/write them like normal
    // filesystem paths.
    if (isPyParityCanonicalPath(canonical)) {
      return createTempPathForVirtualPath(canonical);
    }

    // For other virtual ids, preserve existing behavior: unresolved virtual
    // strings stay virtual and are only mapped when byte-staged.
    return canonical;
  }

  return {
    furnsh: (_kernel, native) => {
      const kernel = _kernel;
      if (typeof kernel === "string") {
        const resolved = resolvePathForSpice(kernel);
        native.furnsh(resolved);

        const canonical = tryCanonicalVirtualKernelPath(kernel);
        if (canonical && tempByVirtualPath.get(canonical) === resolved) {
          loadedVirtualPaths.add(canonical);
        }

        return;
      }

      const virtualPath = canonicalVirtualKernelPath(kernel.path);

      // For byte-backed kernels, we write to a temp file and load via CSPICE.
      // We then remember the resolved temp path so `unload(kernel.path)` unloads
      // the correct file.
      const existingTemp = tempByVirtualPath.get(virtualPath);
      if (existingTemp && loadedVirtualPaths.has(virtualPath)) {
        native.unload(existingTemp);
        loadedVirtualPaths.delete(virtualPath);
      }

      const tempPath = existingTemp ?? createTempPathForVirtualPath(virtualPath);
      fs.writeFileSync(tempPath, kernel.bytes);

      try {
        native.furnsh(tempPath);
      } catch (error) {
        safeUnlink(tempPath);
        loadedVirtualPaths.delete(virtualPath);
        tempByVirtualPath.delete(virtualPath);
        virtualByTempPath.delete(tempPath);
        throw error;
      }

      tempByVirtualPath.set(virtualPath, tempPath);
      virtualByTempPath.set(tempPath, virtualPath);
      loadedVirtualPaths.add(virtualPath);
    },

    unload: (_path, native) => {
      const canonical = tryCanonicalVirtualKernelPath(_path);
      const resolved = canonical ? tempByVirtualPath.get(canonical) : undefined;
      if (canonical && resolved) {
        if (loadedVirtualPaths.has(canonical)) {
          native.unload(resolved);
          loadedVirtualPaths.delete(canonical);
        }

        if (!isPyParityCanonicalPath(canonical)) {
          safeUnlink(resolved);
          tempByVirtualPath.delete(canonical);
          virtualByTempPath.delete(resolved);
        }

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
      loadedVirtualPaths.clear();
      tempByVirtualPath.clear();
      virtualByTempPath.clear();
    },

    resolvePath: resolvePathForSpice,
    resolvePathForSpice,

    virtualizePathFromSpice: (p) => virtualByTempPath.get(p) ?? p,
  };
}
