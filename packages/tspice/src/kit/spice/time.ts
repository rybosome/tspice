import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import { wrapSpiceError } from "../../errors.js";
import type { SpiceTime } from "../../types.js";

export function createTimeKit(cspice: SpiceBackend): {
  toolkitVersion(): string;
  utcToEt(utc: string): SpiceTime;
  etToUtc(et: SpiceTime, format?: string, prec?: number): string;
} {
  return {
    toolkitVersion: () => {
      try {
        return cspice.tkvrsn("TOOLKIT");
      } catch (error) {
        throw wrapSpiceError("toolkitVersion", error);
      }
    },

    utcToEt: (utc) => {
      try {
        return cspice.str2et(utc) as SpiceTime;
      } catch (error) {
        throw wrapSpiceError("utcToEt", error);
      }
    },

    etToUtc: (et, format = "C", prec = 3) => {
      try {
        return cspice.et2utc(et, format, prec);
      } catch (error) {
        throw wrapSpiceError("etToUtc", error);
      }
    },
  };
}
