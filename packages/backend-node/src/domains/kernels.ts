import type { Found, KernelData, KernelKind, KernelSource, KernelsApi } from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { KernelStager } from "../runtime/kernel-staging.js";

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

    ktotal: (kind: KernelKind = "ALL") => {
      const total = native.ktotal(kind);
      invariant(typeof total === "number", "Expected native backend ktotal() to return a number");
      return total;
    },

    kdata: (which: number, kind: KernelKind = "ALL") => {
      const result = native.kdata(which, kind);
      if (!result.found) {
        return { found: false };
      }

      invariant(typeof result.file === "string", "Expected kdata().file to be a string");
      invariant(typeof result.filtyp === "string", "Expected kdata().filtyp to be a string");
      invariant(typeof result.source === "string", "Expected kdata().source to be a string");
      invariant(typeof result.handle === "number", "Expected kdata().handle to be a number");

      return {
        found: true,
        file: result.file,
        filtyp: result.filtyp,
        source: result.source,
        handle: result.handle,
      } satisfies Found<KernelData>;
    },
  };
}
