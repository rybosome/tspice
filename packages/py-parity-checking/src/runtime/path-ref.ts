import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { PathRef, PathRefLike } from "../case-types.js";

export type RuntimePaths = {
  fixturesRoot: string;
  scratchRoot: string;
};

/** Normalize path-ref relative segments and reject traversal forms. */
export function normalizePathRefRelativePath(rel: string): string {
  const normalized = rel.replace(/\\/g, "/");
  if (normalized.length === 0) {
    throw new Error("PathRef.rel must be non-empty");
  }
  if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`PathRef.rel must be package-relative: ${rel}`);
  }

  const collapsed = path.posix.normalize(normalized);
  if (
    collapsed.length === 0 ||
    collapsed === "." ||
    collapsed.startsWith("/") ||
    collapsed === ".." ||
    collapsed.startsWith("../") ||
    collapsed.includes("/../")
  ) {
    throw new Error(`PathRef.rel escapes root: ${rel}`);
  }

  return collapsed;
}

/**
* Normalize incoming path references.
*
* Current default: plain string paths are fixture-relative unless explicitly marked as `scratch`.
*/
export function toPathRef(pathRefLike: PathRefLike): PathRef {
  if (typeof pathRefLike === "string") {
    return {
      kind: "fixture",
      rel: normalizePathRefRelativePath(pathRefLike),
    };
  }

  return {
    kind: pathRefLike.kind,
    rel: normalizePathRefRelativePath(pathRefLike.rel),
  };
}

function resolvePathUnderRoot(root: string, rel: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, rel);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    throw new Error(`Resolved path escapes root: ${rel}`);
  }
  return resolved;
}

/** Resolve a logical PathRef against runtime fixture/scratch roots with traversal checks. */
export function resolvePathRef(paths: RuntimePaths, pathRefLike: PathRefLike): string {
  const pathRef = toPathRef(pathRefLike);
  const root = pathRef.kind === "fixture" ? paths.fixturesRoot : paths.scratchRoot;
  return resolvePathUnderRoot(root, pathRef.rel);
}

/** Resolve a fixture PathRef (or legacy string fixture path) under fixtures root. */
export function resolveFixturePath(fixturesRoot: string, fixtureFile: PathRefLike): string {
  const pathRef = toPathRef(fixtureFile);
  if (pathRef.kind !== "fixture") {
    throw new Error(`Expected fixture PathRef; received ${pathRef.kind}`);
  }
  return resolvePathUnderRoot(fixturesRoot, pathRef.rel);
}

/** Convert a logical PathRef into a stable virtual kernel path used by tspice. */
export function toVirtualKernelPath(pathRefLike: PathRefLike): string {
  const pathRef = toPathRef(pathRefLike);
  if (pathRef.kind === "fixture") {
    return `py-parity/${pathRef.rel}`;
  }
  return `py-parity/scratch/${pathRef.rel}`;
}

/** Normalize backend-reported kernel paths to stable basename-only parity values. */
export function normalizeKernelPathForParity(pathValue: string): string {
  if (pathValue.trim().length === 0) {
    return "";
  }
  return path.basename(pathValue);
}

function sanitizeCaseId(caseId: string): string {
  const cleaned = caseId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned.length > 0 ? cleaned : "case";
}

/** Build per-case runtime fixture/scratch roots. Scratch root is case-scoped and disposable. */
export function createCaseRuntimePaths(fixturesRoot: string, caseId: string): RuntimePaths {
  const scratchPrefix = `py-parity-${sanitizeCaseId(caseId)}-`;
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), scratchPrefix));
  return {
    fixturesRoot: path.resolve(fixturesRoot),
    scratchRoot: path.resolve(scratchRoot),
  };
}

/** Remove scratch-root files best-effort (used in finally blocks/finalizers). */
export function removeScratchRootBestEffort(scratchRoot: string): void {
  try {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
  } catch {
    // best-effort cleanup only
  }
}
