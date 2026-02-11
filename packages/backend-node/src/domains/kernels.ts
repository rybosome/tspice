import type {
  Found,
  KernelData,
  KernelInfo,
  KernelKindInput,
  KernelSource,
  KernelsApi,
} from "@rybosome/tspice-backend-contract";
import {
  matchesKernelKind,
  nativeKindQueryOrNull,
  normalizeKindInput,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { KernelStager } from "../runtime/kernel-staging.js";

export function createKernelsApi(native: NativeAddon, stager: KernelStager): KernelsApi {
  const kernelKindProbeFromNative = (result: { file?: unknown; filtyp?: unknown }) => {
    invariant(typeof result.file === "string", "Expected kdata().file to be a string");
    invariant(typeof result.filtyp === "string", "Expected kdata().filtyp to be a string");
    return {
      file: result.file,
      filtyp: result.filtyp,
    };
  };

  const kernelDataFromNative = (result: {
    file?: unknown;
    filtyp?: unknown;
    source?: unknown;
    handle?: unknown;
  }): KernelData => {
    invariant(typeof result.file === "string", "Expected kdata().file to be a string");
    invariant(typeof result.filtyp === "string", "Expected kdata().filtyp to be a string");
    invariant(typeof result.source === "string", "Expected kdata().source to be a string");
    invariant(typeof result.handle === "number", "Expected kdata().handle to be a number");

    return {
      file: stager.virtualizePathFromSpice(result.file),
      filtyp: result.filtyp.trim(),
      source: stager.virtualizePathFromSpice(result.source),
      handle: result.handle,
    };
  };

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
        filtyp: result.filtyp.trim(),
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
      const kinds = normalizeKindInput(kind);
      if (kinds.length === 0) {
        return 0;
      }

      const nativeQuery = nativeKindQueryOrNull(kinds);
      if (nativeQuery != null) {
        const total = native.ktotal(nativeQuery);
        invariant(typeof total === "number", "Expected native backend ktotal() to return a number");
        return total;
      }

      const requested = new Set(kinds);

      const totalAll = native.ktotal("ALL");
      invariant(typeof totalAll === "number", "Expected native backend ktotal() to return a number");

      let count = 0;
      for (let i = 0; i < totalAll; i++) {
        const result = native.kdata(i, "ALL");
        if (!result.found) {
          continue;
        }

        const probe = kernelKindProbeFromNative(result);
        if (matchesKernelKind(requested, probe)) {
          count++;
        }
      }
      return count;
    },

    kdata: (which: number, kind: KernelKindInput = "ALL") => {
      if (which < 0) {
        return { found: false };
      }

      const kinds = normalizeKindInput(kind);
      if (kinds.length === 0) {
        return { found: false };
      }

      const nativeQuery = nativeKindQueryOrNull(kinds);
      if (nativeQuery != null) {
        const result = native.kdata(which, nativeQuery);
        if (!result.found) {
          return { found: false };
        }

        const kernel = kernelDataFromNative(result);
        return { found: true, ...kernel } satisfies Found<KernelData>;
      }

      const requested = new Set(kinds);

      const totalAll = native.ktotal("ALL");
      invariant(typeof totalAll === "number", "Expected native backend ktotal() to return a number");

      let matchIndex = 0;
      for (let i = 0; i < totalAll; i++) {
        const result = native.kdata(i, "ALL");
        if (!result.found) {
          continue;
        }

        const probe = kernelKindProbeFromNative(result);
        if (!matchesKernelKind(requested, probe)) {
          continue;
        }

        if (matchIndex === which) {
          const kernel = kernelDataFromNative(result);
          return { found: true, ...kernel } satisfies Found<KernelData>;
        }
        matchIndex++;
      }

      return { found: false };
    },
  };
}
