import fs from "node:fs/promises";
import path from "node:path";

import { normalizeRepoRelativePath } from "../util/paths.js";
import type { RepoRelativePath } from "./types.js";

/** Validated workspace package root (including parsed package.json). */
export interface ValidatedPackageRoot {
  /** Repo-relative POSIX path (no leading "./"). */
  packageRoot: RepoRelativePath;
  absPath: string;
  packageJsonPath: string;
  packageJson: unknown;
}

function isErrno(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === "object" && err !== null && "code" in err;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

/** Validate and normalize package root paths (ensures each exists and has a readable package.json). */
export async function validatePackageRoots(opts: {
  repoRoot: string;
  packageRoots: string[];
}): Promise<ValidatedPackageRoot[]> {
  const normalized = opts.packageRoots.map((p) => normalizeRepoRelativePath(p));
  const uniqueSorted = Array.from(new Set(normalized)).sort();

  const out: ValidatedPackageRoot[] = [];

  for (const pkgRoot of uniqueSorted) {
    const absPath = path.resolve(opts.repoRoot, pkgRoot);

    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch (err) {
      if (isErrno(err) && err.code === "ENOENT") {
        throw new Error(`package root not found: ${pkgRoot}`);
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`failed to stat package root ${pkgRoot}: ${msg}`);
    }

    if (!stat.isDirectory()) {
      throw new Error(`package root is not a directory: ${pkgRoot}`);
    }

    const packageJsonPath = path.join(absPath, "package.json");

    let packageJson: unknown;
    try {
      packageJson = await readJsonFile(packageJsonPath);
    } catch (err) {
      if (isErrno(err) && err.code === "ENOENT") {
        throw new Error(`package root is missing package.json: ${pkgRoot}`);
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`failed to read ${pkgRoot}/package.json: ${msg}`);
    }

    out.push({
      packageRoot: pkgRoot,
      absPath,
      packageJsonPath,
      packageJson
    });
  }

  return out;
}
