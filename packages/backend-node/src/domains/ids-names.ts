import { type IdsNamesApi } from "@rybosome/tspice-backend-contract";
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

    bodc2s: (code) => {
      const out = native.bodc2s(code);
      invariant(typeof out === "string", "Expected bodc2s() to return a string");
      return out;
    },

    bods2c: (name) => {
      const out = native.bods2c(name);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.code === "number", "Expected bods2c().code to be a number");
      return { found: true, code: out.code };
    },

    boddef: (name, code) => {
      native.boddef(name, code);
    },

    bodfnd: (body, item) => {
      // `item` normalization is handled by the native addon.
      const out = native.bodfnd(body, item);
      invariant(typeof out === "boolean", "Expected bodfnd() to return a boolean");
      return out;
    },

    bodvar: (body, item) => {
      // `item` normalization is handled by the native addon.
      const out = native.bodvar(body, item);
      invariant(Array.isArray(out), "Expected bodvar() to return an array");
      return out;
    },
  } satisfies IdsNamesApi;
}
