import type { Found, IdsNamesApi } from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

export function createIdsNamesApi(native: NativeAddon): IdsNamesApi {
  return {
    bodn2c: (name) => {
      const out = native.bodn2c(name);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.code === "number", "Expected bodn2c().code to be a number");
      return { found: true, code: out.code };
    },

    bodc2n: (code) => {
      const out = native.bodc2n(code);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.name === "string", "Expected bodc2n().name to be a string");
      return { found: true, name: out.name };
    },
  } satisfies IdsNamesApi;
}
