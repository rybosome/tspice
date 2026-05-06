import type { PathRefLike } from "./case-types.js";
import {
  normalizeKernelPathForParity as normalizeKernelPathForParityCore,
  normalizePathRefRelativePath,
  resolveFixturePath as resolveFixturePathCore,
  resolvePathRef,
  toPathRef,
  toVirtualKernelPath as toVirtualKernelPathCore,
  type RuntimePaths,
} from "./runtime/path-ref.js";

export { resolvePathRef, toPathRef, type RuntimePaths };

/** Compatibility alias for fixture-relative normalization. */
export function normalizeFixtureRelativePath(file: string): string {
  return normalizePathRefRelativePath(file);
}

/** Resolve fixture file refs under fixtures root (supports PathRef and plain string forms). */
export function resolveFixturePath(fixturesRoot: string, fixtureFile: PathRefLike): string {
  return resolveFixturePathCore(fixturesRoot, fixtureFile);
}

/** Convert logical fixture/scratch refs into tspice virtual kernel ids. */
export function toVirtualKernelPath(pathRefLike: PathRefLike): string {
  return toVirtualKernelPathCore(pathRefLike);
}

/** Normalize backend-reported kernel paths to stable basename-only parity values. */
export function normalizeKernelPathForParity(pathValue: string): string {
  return normalizeKernelPathForParityCore(pathValue);
}
