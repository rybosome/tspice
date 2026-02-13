import path from "node:path";

import { normalizeRepoRelativePath, toPosixPath } from "../util/paths.js";
import type { RepoRelativePath } from "./types.js";

export function toRepoRelativePath(repoRoot: string, absPath: string): RepoRelativePath {
  const rel = path.relative(repoRoot, absPath);
  const posix = toPosixPath(rel);
  return normalizeRepoRelativePath(posix);
}

export function isWithinRepoRoot(repoRoot: string, absPath: string): boolean {
  const rel = path.relative(repoRoot, absPath);
  if (rel === "") return true;
  // `path.relative` can return paths like '../x' when outside.
  return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !rel.startsWith("../");
}
