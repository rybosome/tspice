import type { Found, KernelData, KernelKind } from "../shared/types.js";
import type { KernelKindInput } from "./kernels.js";

const SUPPORTED_KERNEL_KINDS = [
  "ALL",
  "SPK",
  "CK",
  "PCK",
  "DSK",
  "TEXT",
  "LSK",
  "FK",
  "IK",
  "SCLK",
  "EK",
  "META",
] as const satisfies readonly KernelKind[];

const SUPPORTED_KERNEL_KIND_SET = new Set<string>(SUPPORTED_KERNEL_KINDS);

function normalizeKindTokenOrThrow(raw: string): KernelKind {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new RangeError("Kernel kind must be a non-empty token");
  }

  const upper = trimmed.toUpperCase();
  if (!SUPPORTED_KERNEL_KIND_SET.has(upper)) {
    throw new RangeError(
      `Unknown kernel kind: ${trimmed}. Expected one of: ${SUPPORTED_KERNEL_KINDS.join(", ")}`,
    );
  }

  return upper as KernelKind;
}

function extLower(path: string): string {
  // Handle both POSIX and Windows separators.
  const base = path.split(/[/\\]/).pop() ?? path;
  const idx = base.lastIndexOf(".");
  if (idx < 0) {
    return "";
  }
  return base.slice(idx).toLowerCase();
}

/**
 * Best-effort inference of TEXT-kernel subtypes from the kernel "file" identifier.
 *
 * SPICE reports many text kernels as `filtyp: "TEXT"` even when they're logically
 * subtypes like LSK/FK/IK/SCLK.
 *
 * We infer subtypes from common NAIF filename extensions, but this is inherently
 * best-effort:
 * - some backends expose *virtual* identifiers that aren't real filesystem paths
 * - identifiers can be extension-less (or use non-standard extensions)
 *
 * In those cases, this returns "TEXT".
 */
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

export function normalizeKindInput(kind: KernelKindInput | undefined): readonly KernelKind[] {
  if (kind == null) {
    return ["ALL"];
  }

  const rawTokens: string[] = [];

  if (Array.isArray(kind)) {
    rawTokens.push(...kind.map((k) => String(k)));
  } else {
    // Allow CSPICE-style multi-kind strings.
    const raw = String(kind);
    if (/\s/.test(raw)) {
      for (const part of raw.trim().split(/\s+/)) {
        if (part) rawTokens.push(part);
      }
    } else {
      rawTokens.push(raw);
    }
  }

  if (rawTokens.length === 0) {
    throw new RangeError("Kernel kind must not be empty");
  }

  return rawTokens.map(normalizeKindTokenOrThrow);
}

function normalizeRequestedKindSetIfNeeded(requestedRaw: ReadonlySet<string>): ReadonlySet<string> {
  for (const raw of requestedRaw) {
    const trimmed = raw.trim();
    if (trimmed !== raw || trimmed.toUpperCase() !== trimmed) {
      // Normalize the query (trim + uppercase) while filtering out empty tokens.
      const normalized = new Set<string>();
      for (const k of requestedRaw) {
        const token = k.trim();
        if (token) normalized.add(token.toUpperCase());
      }
      return normalized;
    }
  }

  return requestedRaw;
}

/**
 * Return whether a kernel matches the requested kind filter.
 *
 * Requested kind tokens are treated as trim + case-insensitive. Empty tokens are ignored.
 *
 * TEXT-kernel subtypes (LSK/FK/IK/SCLK): SPICE reports these as `filtyp: "TEXT"`.
 * When callers request a subtype, we infer it from the `kernel.file` identifier's
 * filename extension (best-effort). If the identifier is virtual or extension-less,
 * subtype matching may fall back to "TEXT".
 */
export function matchesKernelKind(
  requestedRaw: ReadonlySet<string>,
  kernel: Pick<KernelData, "file" | "filtyp">,
): boolean {
  // Normalize the requested set internally so callers can't accidentally pass
  // untrimmed / non-canonical tokens (e.g. "spk", " ALL ").
  //
  // Most call-sites already pass canonical kinds (e.g. via normalizeKindInput),
  // so we avoid allocating a new set unless normalization is needed.
  const requested = normalizeRequestedKindSetIfNeeded(requestedRaw);

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

/**
 * JS implementation of CSPICE `kxtrct`.
 *
 * Notes on return values:
 * - `substr` is right-trimmed (`trimEnd()`).
 * - `wordsq` has the extracted words removed, but otherwise preserves whitespace
 *   from the original input (so it may start with blanks).
 */
export function kxtrctJs(
  keywd: string,
  terms: readonly string[],
  wordsq: string,
): Found<{ wordsq: string; substr: string }> {
  const key = keywd.trim();
  if (key.length === 0) {
    throw new RangeError("kxtrct keywd must be a non-empty string");
  }

  const termSet = new Set(terms.map((t) => t.trim()).filter(Boolean));
  const words = [...wordsq.matchAll(/\S+/g)].map((m) => {
    const text = m[0];
    const start = m.index ?? 0;
    return { text, start, end: start + text.length - 1 };
  });

  const keyIndex = words.findIndex((w) => w.text === key);
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
  const substr = startSub == null ? "" : wordsq.slice(startSub, endSub).trimEnd();

  const removalStart = words[keyIndex]!.start;
  const removalEnd = termIndex >= 0 ? words[(termIndex - 1) as number]!.end + 1 : wordsq.length;
  const newWordsq = wordsq.slice(0, removalStart) + wordsq.slice(removalEnd);

  return { found: true, wordsq: newWordsq, substr };
}
