import path from "node:path";

import { normalizeRepoRelativePath, toPosixPath } from "../util/paths.js";
import type { RepoRelativePath } from "./types.js";

/** Convert an absolute path into a validated repo-relative (posix) path. */
export function toRepoRelativePath(repoRoot: string, absPath: string): RepoRelativePath {
  const rel = path.relative(repoRoot, absPath);
  const posix = toPosixPath(rel);
  return normalizeRepoRelativePath(posix);
}

/** Return true if the absolute path is within the given repo root. */
export function isWithinRepoRoot(repoRoot: string, absPath: string): boolean {
  const rel = path.relative(repoRoot, absPath);
  if (rel === "") return true;
  // `path.relative` can return paths like '../x' when outside.
  return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !rel.startsWith("../");
}
