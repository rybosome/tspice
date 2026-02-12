import type { TimeApi } from "@rybosome/tspice-backend-contract";
import { assertNever, invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

export function createTimeApi(native: NativeAddon): TimeApi {
  function timdef(action: "GET", item: string): string;
  function timdef(action: "SET", item: string, value: string): void;
  function timdef(action: "GET" | "SET", item: string, value?: string): string | void {
    if (item.length === 0) {
      throw new RangeError("timdef(): item must be a non-empty string");
    }

    switch (action) {
      case "GET": {
        const out = native.timdefGet(item);
        invariant(typeof out === "string", "Expected timdef(GET) to return a string");
        return out;
      }

      case "SET": {
        invariant(typeof value === "string", "timdef(SET) requires a string value");
        if (value.length === 0) {
          throw new RangeError("timdef(SET)(): value must be a non-empty string");
        }
        native.timdefSet(item, value);
        return;
      }

      default:
        return assertNever(action, "Unsupported timdef action");
    }
  }

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

    deltet: (epoch, eptype) => {
      invariant(eptype === "ET" || eptype === "UTC", `Unsupported deltet eptype: ${eptype}`);
      const delta = native.deltet(epoch, eptype);
      invariant(typeof delta === "number", "Expected deltet() to return a number");
      return delta;
    },

    unitim: (epoch, insys, outsys) => {
      const out = native.unitim(epoch, insys, outsys);
      invariant(typeof out === "number", "Expected unitim() to return a number");
      return out;
    },

    tparse: (timstr) => {
      if (timstr.length === 0) {
        throw new RangeError("tparse(): timstr must be a non-empty string");
      }
      const et = native.tparse(timstr);
      invariant(typeof et === "number", "Expected tparse() to return a number");
      return et;
    },

    tpictr: (sample, pictur) => {
      if (sample.length === 0) {
        throw new RangeError("tpictr(): sample must be a non-empty string");
      }
      if (pictur.length === 0) {
        throw new RangeError("tpictr(): pictur must be a non-empty string");
      }
      const out = native.tpictr(sample, pictur);
      invariant(typeof out === "string", "Expected tpictr() to return a string");
      return out;
    },

    timdef,

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

    scencd: (sc, sclkch) => {
      const out = native.scencd(sc, sclkch);
      invariant(typeof out === "number", "Expected scencd() to return a number");
      return out;
    },

    scdecd: (sc, sclkdp) => {
      const out = native.scdecd(sc, sclkdp);
      invariant(typeof out === "string", "Expected scdecd() to return a string");
      return out;
    },

    sct2e: (sc, sclkdp) => {
      const out = native.sct2e(sc, sclkdp);
      invariant(typeof out === "number", "Expected sct2e() to return a number");
      return out;
    },

    sce2c: (sc, et) => {
      const out = native.sce2c(sc, et);
      invariant(typeof out === "number", "Expected sce2c() to return a number");
      return out;
    },
  };
}
