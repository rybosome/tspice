import type { TimeApi, TimeKitApi } from "@rybosome/tspice-backend-contract";
import { formatGot, invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

function formatExpectedGot(context: string, expected: string, got: unknown): string {
  return `${context}: Expected: ${expected}. Got: ${formatGot(got)}`;
}

/** Create a {@link TimeApi} implementation backed by the native Node addon. */
export function createTimeApi(native: NativeAddon): TimeApi {
  function timdef(action: "GET", item: string): string;
  function timdef(action: "SET", item: string, value: string): void;
  function timdef(action: "GET" | "SET", item: string, value?: string): string | void {
    if (typeof item !== "string") {
      throw new TypeError(formatExpectedGot("timdef(item)", "a string", item));
    }
    if (item.length === 0) {
      throw new RangeError(formatExpectedGot("timdef(item)", "a non-empty string", item));
    }

    switch (action) {
      case "GET": {
        const out = native.timdefGet(item);
        invariant(typeof out === "string", "Expected timdef(GET) to return a string");
        return out;
      }

      case "SET": {
        if (typeof value !== "string") {
          throw new TypeError(formatExpectedGot("timdef(SET, value)", "a string", value));
        }
        if (value.length === 0) {
          throw new RangeError(formatExpectedGot("timdef(SET, value)", "a non-empty string", value));
        }
        native.timdefSet(item, value);
        return;
      }

      default:
        throw new TypeError(formatExpectedGot("timdef(action)", '"GET" | "SET"', action));
    }
  }

  return {
    tkvrsn: (item) => {
      if (item !== "TOOLKIT") {
        throw new TypeError(formatExpectedGot("tkvrsn(item)", '"TOOLKIT"', item));
      }
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
      if (eptype !== "ET" && eptype !== "UTC") {
        throw new TypeError(formatExpectedGot("deltet(eptype)", '"ET" | "UTC"', eptype));
      }
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
      if (typeof timstr !== "string") {
        throw new TypeError(formatExpectedGot("tparse(timstr)", "a string", timstr));
      }
      if (timstr.length === 0) {
        throw new RangeError(formatExpectedGot("tparse(timstr)", "a non-empty string", timstr));
      }
      const et = native.tparse(timstr);
      invariant(typeof et === "number", "Expected tparse() to return a number");
      return et;
    },

    tpictr: (sample, pictur) => {
      if (typeof sample !== "string") {
        throw new TypeError(formatExpectedGot("tpictr(sample)", "a string", sample));
      }
      if (sample.length === 0) {
        throw new RangeError(formatExpectedGot("tpictr(sample)", "a non-empty string", sample));
      }
      if (typeof pictur !== "string") {
        throw new TypeError(formatExpectedGot("tpictr(pictur)", "a string", pictur));
      }
      if (pictur.length === 0) {
        throw new RangeError(formatExpectedGot("tpictr(pictur)", "a non-empty string", pictur));
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

/** Create a {@link TimeKitApi} implementation backed by the native Node addon. */
export function createTimeKitApi(native: NativeAddon): TimeKitApi {
  return {
    spiceVersion: () => {
      const version = native.spiceVersion();
      invariant(typeof version === "string", "Expected native backend spiceVersion() to return a string");
      return version;
    },
  };
}
