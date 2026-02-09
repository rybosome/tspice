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

function hasMetaKernelListAssignment(text: string, name: string): boolean {
  const clean = stripMetaKernelBegintextBlocks(text);
  const re = new RegExp(String.raw`\b${escapeRegExp(name)}\b\s*(\+?=)\s*\(`, "i");
  return re.test(clean);
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
  if (kernels.length === 0 && hasMetaKernelListAssignment(metaKernelText, "KERNELS_TO_LOAD")) {
    throw new Error(
      `Meta-kernel contained a KERNELS_TO_LOAD assignment but no kernel entries were parsed. ` +
        `Ensure the assignment contains one or more quoted strings. metaKernel=${JSON.stringify(metaKernelPath)}`,
    );
  }
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
 * We achieve this by removing `KERNELS_TO_LOAD` assignments.
 */
export function sanitizeMetaKernelTextForWasm(metaKernelText: string): string {
  const clean = stripMetaKernelBegintextBlocks(metaKernelText);

  // Remove both `KERNELS_TO_LOAD = ( ... )` and `KERNELS_TO_LOAD += ( ... )`.
  // Note: `KERNELS_TO_LOAD = ( )` is not valid CSPICE syntax (BADVARASSIGN).
  const re = /^\s*KERNELS_TO_LOAD\s*\+?=\s*\([\s\S]*?\)\s*/gim;

  // Ideally, only operate in the data section to avoid touching header text.
  // If \\begindata is absent, fall back to sanitizing the whole file.
  const m = clean.match(/\\begindata/i);
  if (!m || m.index === undefined) {
    return clean.replace(re, "");
  }

  const start = m.index + m[0].length;
  const head = clean.slice(0, start);
  const tail = clean.slice(start);

  return head + tail.replace(re, "");
}
