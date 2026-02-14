import fs from "node:fs";
import path, { type PlatformPath } from "node:path";

import type { FixtureRootsV1 } from "./types.js";

export const DEFAULT_FIXTURE_ROOTS_V1: FixtureRootsV1 = {
  FIXTURES: "packages/tspice/test/fixtures",
};

/** Parsed `fixture:` reference (`fixture:<group>/<path>`). */
export interface ParsedFixtureRef {
  readonly root: string;
  readonly relPath: string;
}

/** Parse a `fixture:` reference string; returns null if invalid. */
export function parseFixtureRef(ref: string): ParsedFixtureRef | null {
  if (!ref.startsWith("$")) return null;

  const slashIndex = ref.indexOf("/");
  if (slashIndex <= 1) return null;

  const root = ref.slice(1, slashIndex);
  const relPath = ref.slice(slashIndex + 1);

  if (root.length === 0 || relPath.length === 0) return null;

  // Treat fixture refs as a strict contract: reject roots with leading/trailing
  // whitespace to avoid confusing UX (e.g. "$ FIXTURES/a" failing later as an
  // unknown root).
  if (root.trim() !== root) return null;

  // Fail closed on malformed refs like "$FIXTURES//a" (relPath would start with
  // "/"), which would otherwise be silently normalized downstream.
  if (relPath.startsWith("/")) return null;

  return { root, relPath };
}

/** Options for {@link resolveFixtureRef}. */
export interface ResolveFixtureRefOptions {
  readonly repoRoot: string;
  readonly fixtureRoots?: FixtureRootsV1;
  readonly defaultFixtureRoots?: FixtureRootsV1;

  /**
   * Whether to verify that the resolved fixture path exists and is a file.
   *
   * When enabled, this performs synchronous filesystem IO (e.g. `fs.statSync`).
   *
   * Note: for backwards compatibility, `checkSymlinkContainment` defaults to the
   * same value as `checkExistence`.
   */
  readonly checkExistence?: boolean;

  /**
   * Whether to enforce realpath-based containment checks.
   *
   * This prevents refs from escaping their declared root via symlinks (e.g. a
   * file inside the root that is itself a symlink to a path outside the root, or
   * any symlinked directory segment along the path).
   *
   * Defaults to `checkExistence` for backwards compatibility.
   *
   * Security: disabling this check can allow a fixture ref that is lexically
   * inside the root (no `..` traversal) to resolve to a real path outside the
   * root.
   */
  readonly checkSymlinkContainment?: boolean;
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

/** Options for {@link isPathInside}. */
export interface IsPathInsideOptions {
  readonly pathImpl?: PlatformPath;
  /**
   * Whether comparisons should be case-sensitive.
   *
   * Defaults to case-insensitive for win32-style paths and case-sensitive
   * for posix-style paths.
   */
  readonly caseSensitive?: boolean;
}

const MAX_FIXTURE_REF_SEGMENTS = 64;

function splitRelFixturePath(relPath: string):
  | { readonly ok: true; readonly segments: string[] }
  | { readonly ok: false; readonly message: string } {
  // `String#split` can allocate huge arrays for deeply-nested refs. Fail closed
  // by capping the maximum segment depth.
  const segments = relPath.split("/", MAX_FIXTURE_REF_SEGMENTS + 1);

  if (segments.length > MAX_FIXTURE_REF_SEGMENTS) {
    return {
      ok: false,
      message: `Fixture ref path is too deep (max ${MAX_FIXTURE_REF_SEGMENTS} segments).`,
    };
  }

  if (segments.some((seg) => seg.length === 0)) {
    return {
      ok: false,
      message:
        "Fixture ref paths must not contain empty segments (e.g. 'a//b', leading '/', or trailing '/').",
    };
  }

  return { ok: true, segments };
}

function findNearestExistingAncestor(
  absolutePath: string,
  rootDir: string,
  maxDirnameSteps: number,
): string | null {
  let existingPath = absolutePath;

  for (let i = 0; i <= maxDirnameSteps; i += 1) {
    if (existingPath === rootDir || fs.existsSync(existingPath)) {
      return existingPath;
    }

    const parent = path.dirname(existingPath);
    if (parent === existingPath) break;
    existingPath = parent;
  }

  return null;
}

function normalizeForContainment(
  p: string,
  pathImpl: PlatformPath,
  caseSensitive: boolean,
): string {
  let out = pathImpl.normalize(p);

  // Ensure consistent behavior regardless of trailing separators.
  const root = pathImpl.parse(out).root;
  while (out.length > root.length && out.endsWith(pathImpl.sep)) {
    out = out.slice(0, -1);
  }

  if (!caseSensitive) {
    // NOTE: When caseSensitive=false we approximate case-insensitive containment by
    // lowercasing both normalized paths. This is a pragmatic heuristic and is not
    // equivalent to filesystem case folding for all locales / Unicode edge cases.
    // Do not treat it as a hard security boundary on every platform/filesystem.
    out = out.toLowerCase();
  }

  return out;
}

/**
 * Check whether `childPath` is inside `parentPath` (after resolving/normalizing both).
 */
export function isPathInside(
  baseDir: string,
  candidatePath: string,
  options: IsPathInsideOptions = {},
): boolean {
  const pathImpl = options.pathImpl ?? path;
  const caseSensitive = options.caseSensitive ?? pathImpl.sep !== "\\";

  const rel = pathImpl.relative(
    normalizeForContainment(baseDir, pathImpl, caseSensitive),
    normalizeForContainment(candidatePath, pathImpl, caseSensitive),
  );
  if (rel === "" || rel === ".") return true;

  return (
    rel !== ".." &&
    !rel.startsWith(`..${pathImpl.sep}`) &&
    !pathImpl.isAbsolute(rel)
  );
}

/** Resolve a `fixture:` reference into a concrete OS path under an allowed fixture root. */
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
  const relSplit = splitRelFixturePath(parsed.relPath);
  if (!relSplit.ok) {
    return { ok: false, message: `Invalid fixture ref '${ref}': ${relSplit.message}` };
  }

  const relFsPath = relSplit.segments;
  const absolutePath = path.resolve(rootDir, ...relFsPath);

  // Prevent path traversal outside the declared root.
  if (!isPathInside(rootDir, absolutePath)) {
    return {
      ok: false,
      message: `Fixture ref '${ref}' escapes root '${parsed.root}': ${absolutePath} is outside ${rootDir}`,
    };
  }

  const checkExistence = options.checkExistence === true;
  const checkSymlinkContainment =
    options.checkSymlinkContainment ?? checkExistence;

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
  }

  if (checkSymlinkContainment) {
    // Enforce realpath containment to prevent symlink escapes.
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

    // `fs.realpathSync()` requires the path to exist. If the final file doesn't
    // exist (e.g. a path that will be created later), we still want to enforce
    // that any existing path segments do not escape the root via symlinks.
    const existingPath = findNearestExistingAncestor(
      absolutePath,
      rootDir,
      relFsPath.length,
    );

    if (existingPath === null) {
      return {
        ok: false,
        message: `Failed to enforce symlink containment for ref '${ref}': no existing path segments found under root '${parsed.root}' (${rootDir}). Ensure the fixture root exists or disable 'checkSymlinkContainment'.`,
      };
    }

    let existingReal: string;
    try {
      existingReal = fs.realpathSync(existingPath);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to resolve fixture path real path.";
      return {
        ok: false,
        message: `Failed to resolve fixture path real path for ref '${ref}': ${existingPath}: ${message}`,
      };
    }

    if (!isPathInside(rootReal, existingReal)) {
      return {
        ok: false,
        message: `Fixture ref '${ref}' escapes root '${parsed.root}' via symlink: ${existingPath} -> ${existingReal} (outside ${rootReal})`,
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
