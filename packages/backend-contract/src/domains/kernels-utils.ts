import type { Found, KernelData, KernelKind } from "../shared/types.js";
import type { KernelKindInput } from "./kernels.js";

function extLower(path: string): string {
  // Handle both POSIX and Windows separators.
  const base = path.split(/[/\\]/).pop() ?? path;
  const idx = base.lastIndexOf(".");
  if (idx < 0) {
    return "";
  }
  return base.slice(idx).toLowerCase();
}

function guessTextKernelSubtype(path: string): KernelKind {
  switch (extLower(path)) {
    case ".tls":
    case ".lsk":
      return "LSK";
    case ".tf":
    case ".fk":
      return "FK";
    case ".ti":
    case ".ik":
      return "IK";
    case ".tsc":
    case ".sclk":
      return "SCLK";
    default:
      return "TEXT";
  }
}

export function normalizeKindInput(kind: KernelKindInput | undefined): readonly string[] {
  if (kind == null) {
    return ["ALL"];
  }
  if (Array.isArray(kind)) {
    return kind;
  }

  // Allow CSPICE-style multi-kind strings.
  const raw = String(kind);
  if (/\s/.test(raw)) {
    const parts = raw
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return parts;
  }

  return [raw];
}

export function matchesKernelKind(
  requested: ReadonlySet<string>,
  kernel: Pick<KernelData, "file" | "filtyp">,
): boolean {
  if (requested.size === 0) {
    return false;
  }
  if (requested.has("ALL")) {
    return true;
  }

  const filtyp = kernel.filtyp.toUpperCase();
  if (filtyp === "TEXT") {
    if (requested.has("TEXT")) {
      return true;
    }

    const subtype = guessTextKernelSubtype(kernel.file);
    return requested.has(subtype);
  }

  return requested.has(filtyp);
}

export function kxtrctJs(
  keywd: string,
  terms: readonly string[],
  wordsq: string,
): Found<{ wordsq: string; substr: string }> {
  const termSet = new Set(terms);
  const words = [...wordsq.matchAll(/\S+/g)].map((m) => ({
    text: m[0],
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length - 1,
  }));

  const keyIndex = words.findIndex((w) => w.text === keywd);
  if (keyIndex < 0) {
    return { found: false };
  }

  let termIndex = -1;
  for (let i = keyIndex + 1; i < words.length; i++) {
    if (termSet.has(words[i]!.text)) {
      termIndex = i;
      break;
    }
  }

  const startSub = words[keyIndex + 1]?.start;
  const endSub = termIndex >= 0 ? words[termIndex]!.start : wordsq.length;
  const substr = startSub == null ? "" : wordsq.slice(startSub, endSub);

  const removalStart = words[keyIndex]!.start;
  const removalEnd = termIndex >= 0 ? words[(termIndex - 1) as number]!.end + 1 : wordsq.length;
  const newWordsq = wordsq.slice(0, removalStart) + wordsq.slice(removalEnd);

  return { found: true, wordsq: newWordsq, substr };
}
