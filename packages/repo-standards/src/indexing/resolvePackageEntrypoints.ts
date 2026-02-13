import fs from "node:fs/promises";
import path from "node:path";

import { toPosixPath } from "../util/paths.js";
import type { RepoRelativePath } from "./types.js";
import type { ValidatedPackageRoot } from "./validatePackageRoots.js";

function isErrno(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === "object" && err !== null && "code" in err;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSupportedExportTarget(value: string): boolean {
  // Exports values should be relative, and we only support mapping dist->src for TS analysis.
  if (!value.startsWith("./")) return false;
  if (value.includes("*")) return false;

  const posix = toPosixPath(value).replace(/^\.\//, "");

  if (posix.startsWith("dist/")) {
    return (
      posix.endsWith(".d.ts") ||
      posix.endsWith(".js") ||
      posix.endsWith(".mjs") ||
      posix.endsWith(".cjs")
    );
  }

  if (posix.startsWith("src/")) {
    return posix.endsWith(".ts");
  }

  return false;
}

function collectExportPaths(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    if (isSupportedExportTarget(value)) out.add(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const v of value) collectExportPaths(v, out);
    return;
  }

  if (isRecord(value)) {
    for (const v of Object.values(value)) collectExportPaths(v, out);
  }
}

function extractCandidateEntrypointsFromExports(pkgJson: Record<string, unknown>): string[] {
  if (!("exports" in pkgJson)) return [];

  const exportsField = pkgJson.exports;
  if (exportsField == null) return [];

  const out = new Set<string>();

  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    collectExportPaths(exportsField, out);
    return [...out].sort();
  }

  if (isRecord(exportsField)) {
    const entries = Object.entries(exportsField);
    const keys = entries.map(([k]) => k);

    // Conditional exports for the root entrypoint: { "import": "./dist/index.mjs", ... }
    const hasSubpathKeys = keys.some((k) => k === "." || k.startsWith("./"));
    if (!hasSubpathKeys) {
      collectExportPaths(exportsField, out);
      return [...out].sort();
    }

    // Subpath export map: only index "." + explicit subpaths (ignore globs like "./internal/*").
    if ("." in exportsField) {
      collectExportPaths(exportsField["."], out);
    }

    for (const [key, value] of entries) {
      if (!key.startsWith("./")) continue;
      if (key.includes("*")) continue;
      collectExportPaths(value, out);
    }

    return [...out].sort();
  }

  return [];
}

function extractCandidateEntrypointsFromMainTypes(pkgJson: Record<string, unknown>): string[] {
  const out: string[] = [];

  const types = pkgJson.types;
  if (typeof types === "string") out.push(types);

  const main = pkgJson.main;
  if (typeof main === "string") out.push(main);

  return out;
}

function mapDistToSrc(relPath: string): string | null {
  const posix = toPosixPath(relPath).replace(/^\.\//, "");

  // Canonical heuristics from §4.3.
  if (posix.startsWith("dist/")) {
    const rest = posix.slice("dist/".length);

    if (rest.endsWith(".d.ts")) {
      const base = rest.slice(0, -".d.ts".length);
      return `src/${base}.ts`;
    }

    for (const ext of [".js", ".mjs", ".cjs"]) {
      if (rest.endsWith(ext)) {
        const base = rest.slice(0, -ext.length);
        return `src/${base}.ts`;
      }
    }

    return null;
  }

  // Allow direct source exports for fixtures / odd packages.
  if (posix.startsWith("src/") && posix.endsWith(".ts")) {
    return posix;
  }

  return null;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch (err) {
    if (isErrno(err) && err.code === "ENOENT") return false;
    throw err;
  }
}

export async function resolvePackageEntrypoints(opts: {
  repoRoot: string;
  pkg: ValidatedPackageRoot;
}): Promise<RepoRelativePath[]> {
  if (!isRecord(opts.pkg.packageJson)) {
    throw new Error(`invalid package.json object: ${opts.pkg.packageRoot}`);
  }

  const pkgJson = opts.pkg.packageJson;

  const exportCandidates = extractCandidateEntrypointsFromExports(pkgJson);
  const candidates = exportCandidates.length > 0 ? exportCandidates : extractCandidateEntrypointsFromMainTypes(pkgJson);

  const mapped: RepoRelativePath[] = [];
  const failures: string[] = [];

  // Avoid repeated `stat()` calls when `exports` includes both `.js` + `.d.ts` for the same entry.
  const mappedSrcToCandidates = new Map<string, string[]>();

  for (const candidate of candidates) {
    const mappedSrc = mapDistToSrc(candidate);
    if (!mappedSrc) {
      failures.push(candidate);
      continue;
    }

    const list = mappedSrcToCandidates.get(mappedSrc);
    if (list) list.push(candidate);
    else mappedSrcToCandidates.set(mappedSrc, [candidate]);
  }

  for (const mappedSrc of [...mappedSrcToCandidates.keys()].sort()) {
    const absSrc = path.join(opts.pkg.absPath, mappedSrc);
    if (!(await exists(absSrc))) {
      failures.push(...(mappedSrcToCandidates.get(mappedSrc) ?? []));
      continue;
    }

    mapped.push(path.posix.join(opts.pkg.packageRoot, toPosixPath(mappedSrc)));
  }

  const srcIndexAbs = path.join(opts.pkg.absPath, "src", "index.ts");
  const srcIndexRel = path.posix.join(opts.pkg.packageRoot, "src/index.ts");

  const out = new Set<RepoRelativePath>();

  for (const m of mapped) out.add(m);

  if (await exists(srcIndexAbs)) {
    out.add(srcIndexRel);
  }

  if (out.size === 0) {
    if (failures.length > 0) {
      throw new Error(
        [
          `failed to map package entrypoints to source for ${opts.pkg.packageRoot}`,
          `candidates: ${failures.sort().join(", ")}`,
          `expected convention: ${opts.pkg.packageRoot}/src/index.ts`
        ].join("\n")
      );
    }

    throw new Error(
      `no entrypoints found for ${opts.pkg.packageRoot} (expected exports/main/types or src/index.ts)`
    );
  }

  return [...out].sort();
}
