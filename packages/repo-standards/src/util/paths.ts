import path from "node:path";

export function toPosixPath(p: string): string {
  // Convert both platform-specific separators and any Windows-style separators.
  // (On posix, `path.sep` is already `/`, but configs/CLI args may still contain `\\`.)
  return p.split(path.sep).join("/").replaceAll("\\", "/");
}

export function normalizeRepoRelativePath(input: string): string {
  // We treat config paths as repo-root relative (no leading ./) and we reject
  // anything that could traverse outside the repo.
  const trimmed = input.replace(/^\.\//, "");
  const posix = toPosixPath(trimmed);
  let normalized = path.posix.normalize(posix);

  // Remove a trailing slash for stable equality checks.
  if (normalized.endsWith("/") && normalized !== "/") {
    normalized = normalized.slice(0, -1);
  }

  // `path.posix.isAbsolute()` won't treat Windows drive paths as absolute, so we
  // explicitly guard those too.
  if (path.posix.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`path must be repo-relative (got absolute): ${input}`);
  }

  // After normalization, any `..` that remain at the beginning would escape the repo.
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`path must not traverse outside repo: ${input}`);
  }

  return normalized;
}
