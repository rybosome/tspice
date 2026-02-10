import fs from "node:fs";
import path from "node:path";

import type { FixtureRootsV1 } from "./types.js";

export const DEFAULT_FIXTURE_ROOTS_V1: FixtureRootsV1 = {
  FIXTURES: "packages/tspice/test/fixtures",
};

export interface ParsedFixtureRef {
  readonly root: string;
  readonly relPath: string;
}

export function parseFixtureRef(ref: string): ParsedFixtureRef | null {
  if (!ref.startsWith("$")) return null;

  const slashIndex = ref.indexOf("/");
  if (slashIndex <= 1) return null;

  const root = ref.slice(1, slashIndex);
  const relPath = ref.slice(slashIndex + 1);

  if (root.length === 0 || relPath.length === 0) return null;

  return { root, relPath };
}

export interface ResolveFixtureRefOptions {
  readonly repoRoot: string;
  readonly fixtureRoots?: FixtureRootsV1;
  readonly defaultFixtureRoots?: FixtureRootsV1;
  readonly checkExistence?: boolean;
}

export type ResolveFixtureRefResult =
  | {
      readonly ok: true;
      readonly absolutePath: string;
      readonly root: string;
      readonly rootDir: string;
      readonly relPath: string;
    }
  | { readonly ok: false; readonly message: string };

function isPathInside(baseDir: string, candidatePath: string): boolean {
  const rel = path.relative(baseDir, candidatePath);
  if (rel === "" || rel === ".") return true;

  return (
    rel !== ".." &&
    !rel.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(rel)
  );
}

export function resolveFixtureRef(
  ref: string,
  options: ResolveFixtureRefOptions,
): ResolveFixtureRefResult {
  const parsed = parseFixtureRef(ref);
  if (parsed === null) {
    return {
      ok: false,
      message:
        "Expected a fixture reference like `$FIXTURES/<path>` or `$<ROOT>/<path>`.",
    };
  }

  const fixtureRoots = {
    ...(options.defaultFixtureRoots ?? DEFAULT_FIXTURE_ROOTS_V1),
    ...(options.fixtureRoots ?? {}),
  } as const;

  const rootPath = fixtureRoots[parsed.root];
  if (rootPath === undefined) {
    return {
      ok: false,
      message: `Unknown fixture root '${parsed.root}'. Add it under 'fixtureRoots'.`,
    };
  }

  const rootDir = path.resolve(options.repoRoot, rootPath);

  // Support refs that use '/' even on Windows (YAML is platform-agnostic).
  const relFsPath = parsed.relPath.split("/");
  const absolutePath = path.resolve(rootDir, ...relFsPath);

  // Prevent path traversal outside the declared root.
  if (!isPathInside(rootDir, absolutePath)) {
    return {
      ok: false,
      message: `Fixture ref '${ref}' escapes root '${parsed.root}': ${absolutePath} is outside ${rootDir}`,
    };
  }

  const checkExistence = options.checkExistence === true;

  if (checkExistence) {
    try {
      const stat = fs.statSync(absolutePath);
      if (!stat.isFile()) {
        return {
          ok: false,
          message: `Fixture ref '${ref}' resolved to a non-file path: ${absolutePath}`,
        };
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to stat fixture file.";
      const code =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        typeof (err as { readonly code?: unknown }).code === "string"
          ? (err as { readonly code: string }).code
          : null;

      if (code === "ENOENT") {
        return {
          ok: false,
          message: `Fixture file not found for ref '${ref}': ${absolutePath}`,
        };
      }

      return {
        ok: false,
        message: `Failed to access fixture file for ref '${ref}': ${absolutePath}: ${message}`,
      };
    }

    // When checking existence, also enforce realpath containment to prevent
    // symlink escapes.
    let rootReal: string;
    try {
      rootReal = fs.realpathSync(rootDir);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to resolve fixture root real path.";
      return {
        ok: false,
        message: `Failed to resolve fixture root real path for '${parsed.root}': ${rootDir}: ${message}`,
      };
    }

    let fileReal: string;
    try {
      fileReal = fs.realpathSync(absolutePath);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to resolve fixture file real path.";
      return {
        ok: false,
        message: `Failed to resolve fixture file real path for ref '${ref}': ${absolutePath}: ${message}`,
      };
    }

    if (!isPathInside(rootReal, fileReal)) {
      return {
        ok: false,
        message: `Fixture ref '${ref}' escapes root '${parsed.root}' via symlink: ${absolutePath} -> ${fileReal} (outside ${rootReal})`,
      };
    }
  }

  return {
    ok: true,
    absolutePath,
    root: parsed.root,
    rootDir,
    relPath: parsed.relPath,
  };
}
