import type {
  Found,
  KernelData,
  KernelInfo,
  KernelKind,
  KernelKindInput,
  KernelSource,
  KernelsApi,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { KernelStager } from "../runtime/kernel-staging.js";

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

function normalizeKindInput(kind: KernelKindInput | undefined): readonly string[] {
  if (kind == null) {
    return ["ALL"];
  }
  if (Array.isArray(kind)) {
    return kind;
  }

  // Allow callers to pass CSPICE-style multi-kind strings via casting.
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

function matchesKernelKind(requested: ReadonlySet<string>, kernel: KernelData): boolean {
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

export function createKernelsApi(native: NativeAddon, stager: KernelStager): KernelsApi {
  return {
    furnsh: (kernel: KernelSource) => {
      stager.furnsh(kernel, native);
    },

    unload: (path: string) => {
      stager.unload(path, native);
    },

    kclear: () => {
      stager.kclear(native);
    },

    kinfo: (path: string) => {
      const resolved = stager.resolvePathForSpice(path);

      const result = native.kinfo(resolved);
      if (!result.found) {
        return { found: false };
      }

      invariant(typeof result.filtyp === "string", "Expected kinfo().filtyp to be a string");
      invariant(typeof result.source === "string", "Expected kinfo().source to be a string");
      invariant(typeof result.handle === "number", "Expected kinfo().handle to be a number");

      return {
        found: true,
        filtyp: result.filtyp,
        source: stager.virtualizePathFromSpice(result.source),
        handle: result.handle,
      } satisfies Found<KernelInfo>;
    },

    kxtrct: (keywd, terms, wordsq) => {
      const result = native.kxtrct(keywd, terms, wordsq);
      if (!result.found) {
        return { found: false };
      }

      invariant(typeof result.wordsq === "string", "Expected kxtrct().wordsq to be a string");
      invariant(typeof result.substr === "string", "Expected kxtrct().substr to be a string");

      return { found: true, wordsq: result.wordsq, substr: result.substr };
    },

    kplfrm: (frmcls, idset) => {
      native.kplfrm(frmcls, idset as unknown as number);
    },

    ktotal: (kind: KernelKindInput = "ALL") => {
      const kinds = normalizeKindInput(kind).map((k) => k.toUpperCase());
      const requested = new Set(kinds);

      const totalAll = native.ktotal("ALL");
      invariant(typeof totalAll === "number", "Expected native backend ktotal() to return a number");

      let count = 0;
      for (let i = 0; i < totalAll; i++) {
        const result = native.kdata(i, "ALL");
        if (!result.found) {
          continue;
        }

        invariant(typeof result.file === "string", "Expected kdata().file to be a string");
        invariant(typeof result.filtyp === "string", "Expected kdata().filtyp to be a string");
        invariant(typeof result.source === "string", "Expected kdata().source to be a string");
        invariant(typeof result.handle === "number", "Expected kdata().handle to be a number");

        const kernel: KernelData = {
          file: stager.virtualizePathFromSpice(result.file),
          filtyp: result.filtyp,
          source: stager.virtualizePathFromSpice(result.source),
          handle: result.handle,
        };

        if (matchesKernelKind(requested, kernel)) {
          count++;
        }
      }
      return count;
    },

    kdata: (which: number, kind: KernelKindInput = "ALL") => {
      if (which < 0) {
        return { found: false };
      }

      const kinds = normalizeKindInput(kind).map((k) => k.toUpperCase());
      const requested = new Set(kinds);

      const totalAll = native.ktotal("ALL");
      invariant(typeof totalAll === "number", "Expected native backend ktotal() to return a number");

      let matchIndex = 0;
      for (let i = 0; i < totalAll; i++) {
        const result = native.kdata(i, "ALL");
        if (!result.found) {
          continue;
        }

        invariant(typeof result.file === "string", "Expected kdata().file to be a string");
        invariant(typeof result.filtyp === "string", "Expected kdata().filtyp to be a string");
        invariant(typeof result.source === "string", "Expected kdata().source to be a string");
        invariant(typeof result.handle === "number", "Expected kdata().handle to be a number");

        const kernel: KernelData = {
          file: stager.virtualizePathFromSpice(result.file),
          filtyp: result.filtyp,
          source: stager.virtualizePathFromSpice(result.source),
          handle: result.handle,
        };

        if (!matchesKernelKind(requested, kernel)) {
          continue;
        }

        if (matchIndex === which) {
          return { found: true, ...kernel } satisfies Found<KernelData>;
        }
        matchIndex++;
      }

      return { found: false };
    },
  };
}
