import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import { wrapSpiceError } from "../../errors.js";
import type { SpiceTime } from "../../types.js";

/** Create time/version helpers for a given backend. */
export function createTimeKit(cspice: SpiceBackend): {
  spiceVersion(): string;
  toolkitVersion(): string;
  utcToEt(utc: string): SpiceTime;
  etToUtc(et: SpiceTime, format?: string, prec?: number): string;
} {
  return {
    spiceVersion: () => {
      try {
        return cspice.raw.tkvrsn("TOOLKIT");
      } catch (error) {
        throw wrapSpiceError("spiceVersion", error);
      }
    },

    toolkitVersion: () => {
      try {
        return cspice.raw.tkvrsn("TOOLKIT");
      } catch (error) {
        throw wrapSpiceError("toolkitVersion", error);
      }
    },

    utcToEt: (utc) => {
      try {
        return cspice.raw.str2et(utc);
      } catch (error) {
        throw wrapSpiceError("utcToEt", error);
      }
    },

    etToUtc: (et, format = "C", prec = 3) => {
      try {
        return cspice.raw.et2utc(et, format, prec);
      } catch (error) {
        throw wrapSpiceError("etToUtc", error);
      }
    },
  };
}
