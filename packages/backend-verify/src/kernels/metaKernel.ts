import * as path from "node:path";
import * as fs from "node:fs";

export type ResolveMetaKernelOptions = {
  /**
   * When provided, every resolved kernel path must remain within this directory.
   *
   * This is primarily used for fixture-pack directory aliases so meta-kernels
   * cannot escape the pack by referencing absolute paths.
   */
  restrictToDir?: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove `\\begintext ...` blocks so we don't accidentally parse commented-out
 * assignments.
 */
export function stripMetaKernelBegintextBlocks(text: string): string {
  return text.replace(/\\{1,2}begintext[\s\S]*?(?=\\{1,2}begindata|$)/gi, "");
}

export function extractMetaKernelStringList(text: string, name: string): string[] {
  const clean = stripMetaKernelBegintextBlocks(text);

  // Support both `NAME = ( ... )` and `NAME += ( ... )` assignments.
  const re = new RegExp(
    String.raw`\b${escapeRegExp(name)}\b\s*(\+?=)\s*\(([\s\S]*?)\)`,
    "gi",
  );

  const items: string[] = [];
  for (const match of clean.matchAll(re)) {
    const body = match[2] ?? "";
    for (const m of body.matchAll(/'([^']+)'|\"([^\"]+)\"/g)) {
      const v = m[1] ?? m[2];
      if (v !== undefined) items.push(v);
    }
  }
  return items;
}

function hasMetaKernelListAssignment(text: string, name: string): boolean {
  const clean = stripMetaKernelBegintextBlocks(text);
  const re = new RegExp(String.raw`\b${escapeRegExp(name)}\b\s*(\+?=)\s*\(`, "i");
  return re.test(clean);
}

function canonicalizeForRestriction(p: string): string {
  // `realpath` resolves symlinks (preventing link-based escapes), but it throws
  // for non-existent files. When that happens, fall back to a normalized absolute
  // path so we can still enforce `..`-based escapes.
  //
  // Note: some platforms (e.g. macOS) have symlinked temp dirs like `/tmp -> /private/tmp`.
  // In that case, a non-existent *file* under an existing symlinked directory will cause
  // `realpath` to throw, which can make the child path appear to escape when compared to
  // a realpathed base dir. We try to realpath the deepest existing parent directory and
  // then re-append the remaining path segments.
  try {
    return fs.realpathSync.native(p);
  } catch {
    let cur = path.resolve(p);
    const suffix: string[] = [];

    // Walk up until we find an existing path we can realpath.
    // (This is intentionally sync; it's used during parsing / verification.)
    while (cur !== path.dirname(cur) && !fs.existsSync(cur)) {
      suffix.unshift(path.basename(cur));
      cur = path.dirname(cur);
    }

    try {
      const baseReal = fs.realpathSync.native(cur);
      return path.join(baseReal, ...suffix);
    } catch {
      return path.resolve(p);
    }
  }
}

function ensureWithinDirOrThrow(resolved: string, baseDir: string, message: string): void {
  const rel = path.relative(baseDir, resolved);
  // rel === '' means `resolved === baseDir` which is acceptable.
  if (rel === "") return;

  if (rel === ".." || rel.startsWith(`..${path.sep}`)) {
    throw new Error(message);
  }
}

export function resolveMetaKernelKernelsToLoad(
  metaKernelText: string,
  metaKernelPath: string,
  options: ResolveMetaKernelOptions = {},
): string[] {
  const metaKernelDir = path.dirname(metaKernelPath);

  const restrictToDir = options.restrictToDir;
  const allowedDirReal = restrictToDir ? canonicalizeForRestriction(restrictToDir) : undefined;

  const symbols = extractMetaKernelStringList(metaKernelText, "PATH_SYMBOLS");
  if (symbols.length === 0 && hasMetaKernelListAssignment(metaKernelText, "PATH_SYMBOLS")) {
    throw new Error(
      `Meta-kernel contained a PATH_SYMBOLS assignment but no entries were parsed. ` +
        `Ensure the assignment contains one or more quoted strings. metaKernel=${JSON.stringify(metaKernelPath)}`,
    );
  }

  const valuesRaw = extractMetaKernelStringList(metaKernelText, "PATH_VALUES");
  if (valuesRaw.length === 0 && hasMetaKernelListAssignment(metaKernelText, "PATH_VALUES")) {
    throw new Error(
      `Meta-kernel contained a PATH_VALUES assignment but no entries were parsed. ` +
        `Ensure the assignment contains one or more quoted strings. metaKernel=${JSON.stringify(metaKernelPath)}`,
    );
  }

  const values = valuesRaw.map((v) => (path.isAbsolute(v) ? path.resolve(v) : path.resolve(metaKernelDir, v)));

  const symbolMap = new Map<string, string>();
  for (let i = 0; i < Math.min(symbols.length, values.length); i++) {
    symbolMap.set(symbols[i]!, values[i]!);
  }

  const kernels = extractMetaKernelStringList(metaKernelText, "KERNELS_TO_LOAD");
  if (kernels.length === 0 && hasMetaKernelListAssignment(metaKernelText, "KERNELS_TO_LOAD")) {
    throw new Error(
      `Meta-kernel contained a KERNELS_TO_LOAD assignment but no kernel entries were parsed. ` +
        `Ensure the assignment contains one or more quoted strings. metaKernel=${JSON.stringify(metaKernelPath)}`,
    );
  }

  return kernels.map((k) => {
    const m = k.match(/^\$([A-Za-z0-9_]+)([/\\].*)?$/);
    let resolved: string;
    if (m) {
      const base = symbolMap.get(m[1]!);
      if (base !== undefined) {
        const suffix = (m[2] ?? "").replace(/^[/\\]/, "");
        resolved = path.resolve(base, suffix);
      } else {
        resolved = path.resolve(metaKernelDir, k);
      }
    } else {
      resolved = path.isAbsolute(k) ? path.resolve(k) : path.resolve(metaKernelDir, k);
    }

    if (allowedDirReal) {
      const resolvedReal = canonicalizeForRestriction(resolved);

      ensureWithinDirOrThrow(
        resolvedReal,
        allowedDirReal,
        `Meta-kernel attempted to load a kernel outside of the allowed directory. ` +
          `metaKernel=${JSON.stringify(metaKernelPath)} kernel=${JSON.stringify(k)} resolved=${JSON.stringify(resolved)} ` +
          `resolvedReal=${JSON.stringify(resolvedReal)} allowedDir=${JSON.stringify(restrictToDir)} allowedDirReal=${JSON.stringify(allowedDirReal)}`,
      );
    }

    return resolved;
  });
}

function rewriteMetaKernelStringList(
  text: string,
  name: string,
  rewrite: (value: string) => string,
): string {
  const re = new RegExp(
    String.raw`(\b${escapeRegExp(name)}\b\s*(\+?=)\s*\()([\s\S]*?)(\))`,
    "gi",
  );

  return text.replace(re, (_match, prefix: string, _op: string, body: string, suffix: string) => {
    const nextBody = body.replace(/'([^']+)'|"([^"]+)"/g, (m, s1, s2) => {
      const v = s1 ?? s2;
      if (v === undefined) return m;
      const quote = s1 !== undefined ? "'" : '"';
      return `${quote}${rewrite(v)}${quote}`;
    });

    return `${prefix}${nextBody}${suffix}`;
  });
}

/**
 * For fixture packs: CSPICE resolves *relative* `PATH_VALUES` entries against
 * `process.cwd()` when furnishing a meta-kernel.
 *
 * To avoid `process.chdir()` (global state), we rewrite any relative paths to be
 * absolute (using the intended cwd), which makes the meta-kernel independent of
 * the process working directory.
 *
 * Note: we strip `\begintext` commentary blocks before rewriting so we don't
 * accidentally rewrite commented-out assignments.
 */
export function sanitizeMetaKernelTextForNativeNoBegintextBlocks(
  metaKernelText: string,
  intendedCwd: string,
): string {
  const clean = stripMetaKernelBegintextBlocks(metaKernelText);
  const baseDir = path.resolve(intendedCwd);

  let out = rewriteMetaKernelStringList(clean, "PATH_VALUES", (v) =>
    path.isAbsolute(v) ? path.resolve(v) : path.resolve(baseDir, v),
  );

  // Fully qualify any relative kernel entries so CSPICE does not depend on cwd.
  out = rewriteMetaKernelStringList(out, "KERNELS_TO_LOAD", (k) => {
    if (k.startsWith("$")) return k;
    return path.isAbsolute(k) ? path.resolve(k) : path.resolve(baseDir, k);
  });

  return out;
}

/**
 * For WASM: we may want to furnish the meta-kernel text itself (so any pool
 * assignments apply), but we *must not* let CSPICE try to load OS-path kernels.
 *
 * We achieve this by removing `KERNELS_TO_LOAD` assignments.
 */
export function sanitizeMetaKernelTextForWasm(metaKernelText: string): string {
  // Remove both `KERNELS_TO_LOAD = ( ... )` and `KERNELS_TO_LOAD += ( ... )`.
  // Note: `KERNELS_TO_LOAD = ( )` is not valid CSPICE syntax (BADVARASSIGN).
  const re = /^\s*KERNELS_TO_LOAD\s*\+?=\s*\([\s\S]*?\)\s*/gim;

  // Ideally, only operate in the data section to avoid touching header text.
  // If \\begindata is absent, fall back to sanitizing the whole file.
  const m = metaKernelText.match(/\\{1,2}begindata/i);
  if (!m || m.index === undefined) {
    return metaKernelText.replace(re, "");
  }

  const start = m.index + m[0].length;
  const head = metaKernelText.slice(0, start);
  const rest = metaKernelText.slice(start);

  // Preserve begintext/commentary after the data section.
  // If \\begintext is absent, treat the rest of the file as data.
  const textMarker = rest.match(/\\{1,2}begintext/i);
  if (!textMarker || textMarker.index === undefined) {
    return head + rest.replace(re, "");
  }

  const data = rest.slice(0, textMarker.index);
  const tail = rest.slice(textMarker.index);

  return head + data.replace(re, "") + tail;
}

/**
 * For native: when we expand meta-kernels ourselves (e.g. for `restrictToDir`),
 * we still want to furnish the meta-kernel so pool assignments apply, but we
 * must remove `KERNELS_TO_LOAD` assignments to avoid double-loading and/or
 * bypassing restrictions.
 */
export function sanitizeMetaKernelTextForNativeNoKernels(metaKernelText: string): string {
  // Currently identical to the WASM sanitizer; kept separate for clarity and to
  // allow future divergence (e.g. native-specific rewriting).
  return sanitizeMetaKernelTextForWasm(metaKernelText);
}
