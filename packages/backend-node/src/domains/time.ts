import type { TimeApi } from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

export function createTimeApi(native: NativeAddon): TimeApi {
  return {
    spiceVersion: () => {
      const version = native.spiceVersion();
      invariant(typeof version === "string", "Expected native backend spiceVersion() to return a string");
      return version;
    },

    tkvrsn: (item) => {
      invariant(item === "TOOLKIT", `Unsupported tkvrsn item: ${item}`);
      const version = native.spiceVersion();
      invariant(typeof version === "string", "Expected native backend spiceVersion() to return a string");
      return version;
    },

    str2et: (time) => {
      return native.str2et(time);
    },
    et2utc: (et, format, prec) => {
      return native.et2utc(et, format, prec);
    },
    timout: (et, picture) => {
      return native.timout(et, picture);
    },

    scs2e: (sc, sclkch) => {
      const et = native.scs2e(sc, sclkch);
      invariant(typeof et === "number", "Expected scs2e() to return a number");
      return et;
    },

    sce2s: (sc, et) => {
      const out = native.sce2s(sc, et);
      invariant(typeof out === "string", "Expected sce2s() to return a string");
      return out;
    },
  };
}
