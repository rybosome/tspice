import type { KernelSource, SpiceBackend } from "@rybosome/tspice-backend-contract";

import { createBackend } from "./backend.js";
import { wrapSpiceError } from "./errors.js";
import type {
  AberrationCorrection,
  FrameName,
  GetStateArgs,
  Mat3,
  SpiceTime,
  StateVector,
  Vec3,
} from "./types.js";

export type CreateSpiceOptions = Parameters<typeof createBackend>[0] & {
  /**
   * If provided, `createSpice()` will wrap this backend instead of creating a new one.
   *
   * Useful for testing or advanced callers.
   */
  backendInstance?: SpiceBackend;
};

export type Spice = {
  backend: SpiceBackend;

  loadKernel(kernel: KernelSource): void;
  unloadKernel(path: string): void;

  utcToEt(utc: string): SpiceTime;
  etToUtc(et: SpiceTime, format?: string, prec?: number): string;

  frameTransform(from: FrameName, to: FrameName, et: SpiceTime): Mat3;

  getState(args: GetStateArgs): StateVector;
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

export async function createSpice(options: CreateSpiceOptions = {}): Promise<Spice> {
  const backend = options.backendInstance ?? (await createBackend(options));

  return {
    backend,

    loadKernel: (kernel) => {
      try {
        backend.furnsh(kernel);
      } catch (error) {
        throw wrapSpiceError("loadKernel", error);
      }
    },
    unloadKernel: (path) => {
      try {
        backend.unload(path);
      } catch (error) {
        throw wrapSpiceError("unloadKernel", error);
      }
    },

    utcToEt: (utc) => {
      try {
        return backend.str2et(utc) as SpiceTime;
      } catch (error) {
        throw wrapSpiceError("utcToEt", error);
      }
    },
    etToUtc: (et, format = "C", prec = 3) => {
      try {
        return backend.et2utc(et, format, prec);
      } catch (error) {
        throw wrapSpiceError("etToUtc", error);
      }
    },

    frameTransform: (from, to, et) => {
      try {
        return backend.pxform(from, to, et) as Mat3;
      } catch (error) {
        throw wrapSpiceError("frameTransform", error);
      }
    },

    getState: ({ target, observer, at, frame = DEFAULT_FRAME, aberration = DEFAULT_ABERRATION }) => {
      try {
        const { state, lt } = backend.spkezr(target, at, frame, aberration, observer);
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
}
