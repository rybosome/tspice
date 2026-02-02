import type { KernelSource, SpiceBackend } from "@rybosome/tspice-backend-contract";

import type { CreateBackendOptions } from "./backend.js";
import { createBackend } from "./backend.js";
import { wrapSpiceError } from "./errors.js";
import type {
  AberrationCorrection,
  FrameName,
  Mat3,
  SpiceTime,
  Vec3,
} from "./types.js";

import type { Spice, SpiceKit } from "./spice-types.js";

export type CreateSpiceOptions = CreateBackendOptions & {
  /**
   * If provided, `createSpice()` will wrap this backend instead of creating a new one.
   *
   * Useful for testing or advanced callers.
   */
  backendInstance?: SpiceBackend;
};

const DEFAULT_FRAME: FrameName = "J2000";
const DEFAULT_ABERRATION: AberrationCorrection = "NONE";

function splitState(state: readonly [number, number, number, number, number, number]): {
  position: Vec3;
  velocity: Vec3;
} {
  const position: Vec3 = [state[0], state[1], state[2]];
  const velocity: Vec3 = [state[3], state[4], state[5]];
  return { position, velocity };
}

export async function createSpice(options: CreateSpiceOptions): Promise<Spice> {
  const backend = options.backendInstance ?? (await createBackend(options));
  const raw = backend;

  const kit: SpiceKit = {
    loadKernel: (kernel: KernelSource) => {
      try {
        raw.furnsh(kernel);
      } catch (error) {
        throw wrapSpiceError("loadKernel", error);
      }
    },
    unloadKernel: (path) => {
      try {
        raw.unload(path);
      } catch (error) {
        throw wrapSpiceError("unloadKernel", error);
      }
    },

    toolkitVersion: () => {
      try {
        return raw.tkvrsn("TOOLKIT");
      } catch (error) {
        throw wrapSpiceError("toolkitVersion", error);
      }
    },

    utcToEt: (utc) => {
      try {
        return raw.str2et(utc) as SpiceTime;
      } catch (error) {
        throw wrapSpiceError("utcToEt", error);
      }
    },
    etToUtc: (et, format = "C", prec = 3) => {
      try {
        return raw.et2utc(et, format, prec);
      } catch (error) {
        throw wrapSpiceError("etToUtc", error);
      }
    },

    frameTransform: (from, to, et) => {
      try {
        return raw.pxform(from, to, et) as Mat3;
      } catch (error) {
        throw wrapSpiceError("frameTransform", error);
      }
    },

    getState: ({ target, observer, at, frame = DEFAULT_FRAME, aberration = DEFAULT_ABERRATION }) => {
      try {
        const { state, lt } = raw.spkezr(target, at, frame, aberration, observer);
        const { position, velocity } = splitState(state);
        return {
          et: at,
          frame,
          target,
          observer,
          aberration,
          position,
          velocity,
          lightTime: lt,
        };
      } catch (error) {
        throw wrapSpiceError("getState", error);
      }
    },
  };

  return { raw, kit };
}
