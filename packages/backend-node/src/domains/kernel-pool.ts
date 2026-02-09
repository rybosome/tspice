import type {
  KernelPoolApi,
  KernelPoolVarType,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

export function createKernelPoolApi(native: NativeAddon): KernelPoolApi {
  return {
    gdpool: (name, start, room) => {
      const out = native.gdpool(name, start, room);
      if (!out.found) {
        return { found: false };
      }
      invariant(Array.isArray(out.values), "Expected gdpool().values to be an array");
      return { found: true, values: out.values };
    },

    gipool: (name, start, room) => {
      const out = native.gipool(name, start, room);
      if (!out.found) {
        return { found: false };
      }
      invariant(Array.isArray(out.values), "Expected gipool().values to be an array");
      return { found: true, values: out.values };
    },

    gcpool: (name, start, room) => {
      const out = native.gcpool(name, start, room);
      if (!out.found) {
        return { found: false };
      }
      invariant(Array.isArray(out.values), "Expected gcpool().values to be an array");
      return { found: true, values: out.values };
    },

    gnpool: (template, start, room) => {
      const out = native.gnpool(template, start, room);
      if (!out.found) {
        return { found: false };
      }
      invariant(Array.isArray(out.values), "Expected gnpool().values to be an array");
      return { found: true, values: out.values };
    },

    dtpool: (name) => {
      const out = native.dtpool(name);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.n === "number", "Expected dtpool().n to be a number");
      invariant(typeof out.type === "string", "Expected dtpool().type to be a string");
      const t = out.type.trim();
      if (t !== "C" && t !== "N") {
        throw new Error(`dtpool(): unexpected type '${t}' for ${name}`);
      }
      return { found: true, n: out.n, type: t };
    },

    pdpool: (name, values) => {
      native.pdpool(name, [...values]);
    },

    pipool: (name, values) => {
      native.pipool(name, [...values]);
    },

    pcpool: (name, values) => {
      native.pcpool(name, [...values]);
    },

    swpool: (agent, names) => {
      native.swpool(agent, [...names]);
    },

    cvpool: (agent) => {
      const out = native.cvpool(agent);
      invariant(typeof out === "boolean", "Expected cvpool() to return a boolean");
      return out;
    },

    expool: (name) => {
      const out = native.expool(name);
      invariant(typeof out === "boolean", "Expected expool() to return a boolean");
      return out;
    },
  } satisfies KernelPoolApi;
}
