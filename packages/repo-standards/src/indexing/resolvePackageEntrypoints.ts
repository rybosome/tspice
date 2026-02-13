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

function collectExportPaths(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
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

  const out: string[] = [];
  collectExportPaths(exportsField, out);
  return out;
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

  for (const candidate of candidates) {
    const mappedSrc = mapDistToSrc(candidate);
    if (!mappedSrc) {
      failures.push(candidate);
      continue;
    }

    const absSrc = path.join(opts.pkg.absPath, mappedSrc);
    if (!(await exists(absSrc))) {
      failures.push(candidate);
      continue;
    }

    // Repo-relative path for the source entrypoint.
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
