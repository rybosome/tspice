import path from "node:path";

export function toPosixPath(p: string): string {
  return p.split(path.sep).join("/");
}

export function normalizeRepoRelativePath(input: string): string {
  // We treat config paths as repo-root relative (no leading ./).
  const trimmed = input.replace(/^\.\//, "");
  return toPosixPath(trimmed);
}
