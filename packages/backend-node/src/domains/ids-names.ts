import { type IdsNamesApi } from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  invariant,
  normalizeBodItem,
} from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

function bodyItem(item: string, fn: string): string {
  if (typeof item !== "string")
    throw new TypeError(`${fn}(item): expected a string`);
  const normalized = normalizeBodItem(item);
  if (normalized.length === 0)
    throw new RangeError(`${fn}(item): expected a non-empty item`);
  // The addon owns native normalization; validate its input without changing
  // the established pass-through adapter contract.
  return item;
}

/** Create an {@link IdsNamesApi} implementation backed by the native Node addon. */
export function createIdsNamesApi(native: NativeAddon): IdsNamesApi {
  return {
    bodn2c: (name) => {
      const out = native.bodn2c(name);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        typeof out.code === "number",
        "Expected bodn2c().code to be a number",
      );
      return { found: true, code: out.code };
    },

    bodc2n: (code) => {
      assertSpiceInt32(code, "bodc2n(code)");
      const out = native.bodc2n(code);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        typeof out.name === "string",
        "Expected bodc2n().name to be a string",
      );
      return { found: true, name: out.name };
    },

    bodc2s: (code) => {
      assertSpiceInt32(code, "bodc2s(code)");
      const out = native.bodc2s(code);
      invariant(
        typeof out === "string",
        "Expected bodc2s() to return a string",
      );
      return out;
    },

    bods2c: (name) => {
      const out = native.bods2c(name);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        typeof out.code === "number",
        "Expected bods2c().code to be a number",
      );
      return { found: true, code: out.code };
    },

    boddef: (name, code) => {
      assertSpiceInt32(code, "boddef(code)");
      native.boddef(name, code);
    },

    bodfnd: (body, item) => {
      assertSpiceInt32(body, "bodfnd(body)");
      const out = native.bodfnd(body, bodyItem(item, "bodfnd"));
      invariant(
        typeof out === "boolean",
        "Expected bodfnd() to return a boolean",
      );
      return out;
    },

    bodvar: (body, item) => {
      assertSpiceInt32(body, "bodvar(body)");
      const out = native.bodvar(body, bodyItem(item, "bodvar"));
      invariant(Array.isArray(out), "Expected bodvar() to return an array");
      return out;
    },
  } satisfies IdsNamesApi;
}
