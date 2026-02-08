import * as path from "node:path";

export type ResolveMetaKernelOptions = {
  /**
   * When provided, any kernel path that was not explicitly absolute in the
   * meta-kernel must resolve within this directory.
   */
  restrictToDir?: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\$&");
}

/**
 * Remove `\\begintext ...` blocks so we don't accidentally parse commented-out
 * assignments.
 */
export function stripMetaKernelBegintextBlocks(text: string): string {
  return text.replace(/\\begintext[\s\S]*?(?=\\begindata|$)/gi, "");
}

export function extractMetaKernelStringList(text: string, name: string): string[] {
  const clean = stripMetaKernelBegintextBlocks(text);

  // Support both `NAME = ( ... )` and `NAME += ( ... )` assignments.
  const re = new RegExp(String.raw`\b${escapeRegExp(name)}\b\s*(\+?=)\s*\(([\s\S]*?)\)`, "gi");

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

  const symbols = extractMetaKernelStringList(metaKernelText, "PATH_SYMBOLS");
  const valuesRaw = extractMetaKernelStringList(metaKernelText, "PATH_VALUES");
  const values = valuesRaw.map((v) => (path.isAbsolute(v) ? v : path.resolve(metaKernelDir, v)));

  const symbolMap = new Map<string, string>();
  for (let i = 0; i < Math.min(symbols.length, values.length); i++) {
    symbolMap.set(symbols[i]!, values[i]!);
  }

  const kernels = extractMetaKernelStringList(metaKernelText, "KERNELS_TO_LOAD");
  return kernels.map((k) => {
    const explicitAbsolute = path.isAbsolute(k);

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
      resolved = explicitAbsolute ? k : path.resolve(metaKernelDir, k);
    }

    const restrictToDir = options.restrictToDir;
    if (restrictToDir && !explicitAbsolute) {
      ensureWithinDirOrThrow(
        resolved,
        restrictToDir,
        `Meta-kernel attempted to load a kernel outside of the allowed directory. ` +
          `metaKernel=${JSON.stringify(metaKernelPath)} kernel=${JSON.stringify(k)} resolved=${JSON.stringify(resolved)} allowedDir=${JSON.stringify(restrictToDir)}`,
      );
    }

    return resolved;
  });
}

/**
 * For WASM: we may want to furnish the meta-kernel text itself (so any pool
 * assignments apply), but we *must not* let CSPICE try to load OS-path kernels.
 *
 * We achieve this by emptying `KERNELS_TO_LOAD` assignments.
 */
export function sanitizeMetaKernelTextForWasm(metaKernelText: string): string {
  // Replace both `KERNELS_TO_LOAD = ( ... )` and `KERNELS_TO_LOAD += ( ... )`.
  return metaKernelText.replace(/\bKERNELS_TO_LOAD\b\s*\+?=\s*\(([\s\S]*?)\)/gi, "KERNELS_TO_LOAD = ( )");
}
