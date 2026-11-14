import type { ErrorApi } from "@rybosome/tspice-backend-contract";
import {
  policyArguments,
  assertGetmsgWhich,
  assertSpiceInt32,
  invariant,
  spiceStringByteLength,
} from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

/** Create an {@link ErrorApi} implementation backed by the native Node addon. */
export function createErrorApi(native: NativeAddon): ErrorApi {
  function errdev(op: "GET", capacity?: number): string;
  function errdev(op: "SET", value: string): void;
  function errdev(
    op: "GET" | "SET",
    argument?: number | string,
  ): string | void {
    const call = policyArguments(op, argument, 256);
    const result = native.errdev(op, call.value, call.capacity);
    if (!call.set) return result;
  }

  function errprt(op: "GET", capacity?: number): string;
  function errprt(op: "SET", value: string): void;
  function errprt(
    op: "GET" | "SET",
    argument?: number | string,
  ): string | void {
    const call = policyArguments(op, argument, 41);
    const result = native.errprt(op, call.value, call.capacity);
    if (!call.set) return result;
  }

  return {
    errdev,
    errprt,
    trcoff: () => native.trcoff(),
    errch: (marker, value) => {
      spiceStringByteLength(marker, "marker");
      spiceStringByteLength(value, "value");
      native.errch(marker, value);
    },
    errdp: (marker, value) => {
      spiceStringByteLength(marker, "marker");
      if (!Number.isFinite(value))
        throw new TypeError("errdp expects a finite number");
      native.errdp(marker, value);
    },
    errint: (marker, value) => {
      spiceStringByteLength(marker, "marker");
      assertSpiceInt32(value, "value");
      native.errint(marker, value);
    },
    qcktrc: (tracelen = 4096) => {
      assertSpiceInt32(tracelen, "tracelen");
      return native.qcktrc(tracelen);
    },
    return: () => native.return(),
    trcdep: () => native.trcdep(),
    trcnam: (index, namlen = 33) => {
      assertSpiceInt32(index, "index");
      assertSpiceInt32(namlen, "namlen");
      return native.trcnam(index, namlen);
    },

    failed: () => {
      const out = native.failed();
      invariant(
        typeof out === "boolean",
        "Expected native backend failed() to return a boolean",
      );
      return out;
    },

    reset: () => {
      native.reset();
    },

    getmsg: (which) => {
      assertGetmsgWhich(which);
      const out = native.getmsg(which);
      invariant(
        typeof out === "string",
        "Expected native backend getmsg() to return a string",
      );
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
