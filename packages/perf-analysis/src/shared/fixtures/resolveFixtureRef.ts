import * as fs from "node:fs";
import * as path from "node:path";

import type { FixtureRef, FixtureRoots, ResolvedFixtureRef } from "./types.js";

export type ResolveFixtureRefOptions = {
  /**
   * Base directory used to resolve relative fixture paths and relative
   * `fixtureRoots` entries.
   *
   * Defaults to `process.cwd()` for backwards compatibility.
   */
  readonly baseDir?: string;
};

function isExistingDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(p: string): boolean {
  return fs.existsSync(p);
}

function ensureWithinDirOrThrow(resolved: string, baseDir: string, message: string): void {
  const rel = path.relative(baseDir, resolved);
  // rel === '' means `resolved === baseDir` which is acceptable.
  if (rel === "") return;

  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(message);
  }
}

function resolveFixturePackDir(dirPath: string, originalEntry: string): ResolvedFixtureRef {
  const metaKernel = path.join(dirPath, `${path.basename(dirPath)}.tm`);
  if (!fileExists(metaKernel)) {
    throw new Error(
      `Fixture-pack directory ${JSON.stringify(dirPath)} was treated as an alias but is missing meta-kernel ${JSON.stringify(metaKernel)}.` +
        ` (from ${JSON.stringify(originalEntry)}) ` +
        `If you meant to load a specific kernel file, reference it directly (e.g. ${JSON.stringify(metaKernel)}).`,
    );
  }

  return { path: metaKernel, restrictToDir: dirPath };
}

function maybeExpandDirAlias(resolved: string, originalEntry: string): ResolvedFixtureRef {
  if (isExistingDir(resolved)) {
    return resolveFixturePackDir(resolved, originalEntry);
  }

  return { path: resolved };
}

function resolveUnderFixtureRoots(
  suffix: string,
  fixtureRoots: FixtureRoots,
  originalEntry: string,
): ResolvedFixtureRef {
  if (fixtureRoots.length === 0) {
    throw new Error(
      `Cannot resolve ${JSON.stringify(originalEntry)}: fixtureRoots was empty. ` +
        `Provide fixtureRoots in the suite YAML or via CLI options.`,
    );
  }

  const attempted: string[] = [];

  for (const rootRaw of fixtureRoots) {
    const root = path.resolve(rootRaw);
    const resolved = path.resolve(root, suffix);
    ensureWithinDirOrThrow(
      resolved,
      root,
      `$FIXTURES reference must not escape fixture root: ${JSON.stringify(originalEntry)} (root=${JSON.stringify(root)})`,
    );

    attempted.push(resolved);

    if (fileExists(resolved)) {
      const ref = maybeExpandDirAlias(resolved, originalEntry);
      return {
        ...ref,
        // The `$FIXTURES/...` suffix is a stable id-ish key for debugging.
        id: `$FIXTURES/${suffix.replaceAll(path.sep, "/")}`,
      };
    }
  }

  throw new Error(
    `Unable to resolve ${JSON.stringify(originalEntry)} under fixtureRoots. Tried:\n` +
      attempted.map((p) => `- ${p}`).join("\n"),
  );
}

/**
 * Resolve a `FixtureRef` against a set of `fixtureRoots`.
 *
 * NOTE: fixture resolution is intentionally unimplemented in this scaffold.
 */
export function resolveFixtureRef(
  ref: FixtureRef,
  fixtureRoots: FixtureRoots,
  options: ResolveFixtureRefOptions = {},
): ResolvedFixtureRef {
  const baseDir = options.baseDir ?? process.cwd();

  if (ref.kind === "id") {
    const attempted: string[] = [];
    for (const rootRaw of fixtureRoots) {
      const root = path.resolve(baseDir, rootRaw);

      const resolved = path.resolve(root, ref.id);
      ensureWithinDirOrThrow(
        resolved,
        root,
        `Fixture id must not escape fixture root: ${JSON.stringify(ref.id)} (root=${JSON.stringify(root)})`,
      );
      attempted.push(resolved);

      if (fileExists(resolved)) {
        const out = maybeExpandDirAlias(resolved, ref.id);
        return { ...out, id: ref.id };
      }
    }

    throw new Error(
      `Unable to resolve fixture id ${JSON.stringify(ref.id)} under fixtureRoots. Tried:\n` +
        attempted.map((p) => `- ${p}`).join("\n"),
    );
  }

  const p = ref.path;

  // Absolute paths are passed through.
  if (path.isAbsolute(p)) {
    return maybeExpandDirAlias(path.resolve(p), p);
  }

  // Expand `$FIXTURES/...` against fixture roots.
  if (p === "$FIXTURES" || p.startsWith("$FIXTURES/") || p.startsWith("$FIXTURES\\")) {
    const suffix = p.slice("$FIXTURES".length).replace(/^[/\\]/, "");
    return resolveUnderFixtureRoots(suffix, fixtureRoots.map((r) => path.resolve(baseDir, r)), p);
  }

  if (p.startsWith("$FIXTURES")) {
    throw new Error(
      `Invalid $FIXTURES usage: ${JSON.stringify(p)} (expected $FIXTURES/<path>)`,
    );
  }

  // Otherwise, resolve relative paths against the provided baseDir.
  return maybeExpandDirAlias(path.resolve(baseDir, p), p);
}
