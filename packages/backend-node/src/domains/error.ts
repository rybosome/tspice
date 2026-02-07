import { assertGetmsgWhich, type ErrorApi } from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

export function createErrorApi(native: NativeAddon): ErrorApi {
  return {
    failed: () => {
      const out = native.failed();
      invariant(typeof out === "boolean", "Expected native backend failed() to return a boolean");
      return out;
    },

    reset: () => {
      native.reset();
    },

    getmsg: (which) => {
      assertGetmsgWhich(which);
      const out = native.getmsg(which);
      invariant(typeof out === "string", "Expected native backend getmsg() to return a string");
      return out;
    },

    setmsg: (message) => {
      native.setmsg(message);
    },

    sigerr: (short) => {
      native.sigerr(short);
    },

    chkin: (name) => {
      native.chkin(name);
    },

    chkout: (name) => {
      native.chkout(name);
    },
  };
}
