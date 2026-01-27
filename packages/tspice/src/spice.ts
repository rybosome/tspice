import type { KernelSource, SpiceBackend } from "@rybosome/tspice-backend-contract";

import type { CreateBackendOptions } from "./backend.js";
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

export type CreateSpiceOptions = CreateBackendOptions & {
  /**
   * If provided, `createSpice()` will wrap this backend instead of creating a new one.
   *
   * Useful for testing or advanced callers.
   */
  backendInstance?: SpiceBackend;
};

export type SpiceFacade = {
  backend: SpiceBackend;

  loadKernel(kernel: KernelSource): void;
  unloadKernel(path: string): void;

  utcToEt(utc: string): SpiceTime;
  etToUtc(et: SpiceTime, format?: string, prec?: number): string;

  frameTransform(from: FrameName, to: FrameName, et: SpiceTime): Mat3;

  getState(args: GetStateArgs): StateVector;
};

// Public type: callers get the mid-level facade helpers *plus* the backend
// primitive surface at the top-level.
export type Spice = SpiceFacade & SpiceBackend;

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

  const facade: SpiceFacade = {
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

  const backendMethodCache = new Map<PropertyKey, unknown>();

  function maybeWrapBackendMethod(value: unknown, prop: PropertyKey): unknown {
    if (typeof value !== "function") {
      return value;
    }

    // Keep function identity stable per-property (helps with equality checks,
    // and avoids allocating a new wrapper on every property access).
    const cached = backendMethodCache.get(prop);
    if (cached) {
      return cached;
    }

    // Bind the backend method so `this` is always the backend instance.
    const bound = (value as (...args: any[]) => any).bind(backend);

    const wrapped = (...args: any[]): any => {
      try {
        const result = bound(...args);

        // Most SpiceBackend methods are sync today, but handle Promise-like
        // results defensively so we can consistently wrap async failures too.
        if (
          result &&
          (typeof result === "object" || typeof result === "function") &&
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          typeof (result as any).then === "function"
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return (result as any).catch((error: unknown) => {
            throw wrapSpiceError(String(prop), error);
          });
        }

        return result;
      } catch (error) {
        throw wrapSpiceError(String(prop), error);
      }
    };

    backendMethodCache.set(prop, wrapped);
    return wrapped;
  }

  // The returned object behaves like the facade, but any unknown property is
  // forwarded to the backend. Facade keys win when there is overlap.
  const spice = new Proxy(facade, {
    get(target, prop, receiver) {
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }

      const value = Reflect.get(backend as any, prop, backend as any);
      return maybeWrapBackendMethod(value, prop);
    },
    has(target, prop) {
      return prop in target || prop in (backend as any);
    },
  });

  return spice as unknown as Spice;
}
