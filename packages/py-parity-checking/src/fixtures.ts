import path from "node:path";

/** Normalize package-local fixture path segments and reject traversal forms. */
export function normalizeFixtureRelativePath(file: string): string {
  const normalized = file.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.startsWith("..")) {
    throw new Error(`Fixture path must be package-relative: ${file}`);
  }

  const collapsed = path.posix.normalize(normalized);
  if (collapsed.startsWith("..") || collapsed.includes("/../")) {
    throw new Error(`Fixture path escapes fixture root: ${file}`);
  }
  return collapsed;
}

/** Resolve a fixture file under the provided fixtures root with traversal checks. */
export function resolveFixturePath(fixturesRoot: string, fixtureFile: string): string {
  const relative = normalizeFixtureRelativePath(fixtureFile);
  const resolved = path.resolve(fixturesRoot, relative);
  const rootResolved = path.resolve(fixturesRoot);
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error(`Resolved fixture path escapes root: ${fixtureFile}`);
  }
  return resolved;
}

/** Convert a fixture-relative file into a WASM virtual kernel id. */
export function toVirtualKernelPath(fixtureFile: string): string {
  const relative = normalizeFixtureRelativePath(fixtureFile);
  return `py-parity/${relative}`;
}

/** Normalize backend-reported kernel paths to stable basename-only parity values. */
export function normalizeKernelPathForParity(pathValue: string): string {
  if (pathValue.trim().length === 0) {
    return "";
  }
  return path.basename(pathValue);
}
