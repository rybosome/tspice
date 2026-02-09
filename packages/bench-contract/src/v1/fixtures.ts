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
  const relative = path.relative(rootDir, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return {
      ok: false,
      message: `Fixture ref '${ref}' escapes root '${parsed.root}'.`,
    };
  }

  if (options.checkExistence === true) {
    try {
      const stat = fs.statSync(absolutePath);
      if (!stat.isFile()) {
        return {
          ok: false,
          message: `Fixture ref '${ref}' resolved to a non-file path: ${absolutePath}`,
        };
      }
    } catch {
      return {
        ok: false,
        message: `Fixture file not found for ref '${ref}': ${absolutePath}`,
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
