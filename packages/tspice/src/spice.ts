import type { SpiceBackend, SpiceBackendKind } from "@rybosome/tspice-backend-contract";
import type { SpiceKitCompatHelpers } from "@rybosome/tspice-core";

import type { CreateBackendOptions } from "./backend.js";
import { createBackend } from "./backend.js";

import type { PromisifyObject, Spice, SpiceAsync } from "./kit/types/spice-types.js";
import { createKit } from "./kit/spice/create-kit.js";

export type CreateSpiceOptions = CreateBackendOptions & {
  /**
   * If provided, `createSpice()` will wrap this backend instead of creating a new one.
   *
   * Useful for testing or advanced callers.
   */
  backendInstance?: (SpiceBackend & { kind: SpiceBackendKind }) & Partial<SpiceKitCompatHelpers>;
};

export type CreateSpiceAsyncOptions = CreateSpiceOptions;

type BackendRuntimeSurface = (SpiceBackend & { kind: SpiceBackendKind }) & Partial<SpiceKitCompatHelpers>;

const HIDDEN_RAW_KEYS = new Set<string>([
  // Moved off raw (strict/fast cleanup) onto `kit.*`.
  "newIntCell",
  "newDoubleCell",
  "newCharCell",
  "newWindow",
  "freeCell",
  "freeWindow",
  "cellGeti",
  "cellGetd",
  "cellGetc",
  "spiceVersion",
  "readVirtualOutput",

  // Ownership moved to the top-level `Spice` / `SpiceAsync` object.
  "kind",
]);

function isHiddenRawKey(prop: PropertyKey): boolean {
  return typeof prop === "string" && HIDDEN_RAW_KEYS.has(prop);
}

/**
 * Create a sync {@link Spice} client backed by the requested backend/transport.
 */
export async function createSpice(options: CreateSpiceOptions): Promise<Spice> {
  const backend = (options.backendInstance ?? (await createBackend(options))) as BackendRuntimeSurface;

  // Track kernels loaded from bytes so `kit.unloadKernel()` can accept flexible
  // path forms (e.g. `/kernels/foo.tls`) across backends.
  const byteBackedKernelPaths = new Set<string>();

  // Keep `raw.kclear()` and `kit`'s internal tracking in sync.
  //
  // Use a Proxy so:
  // - prototype methods aren't lost (object spread only copies own props)
  // - methods are bound to the original backend instance (avoid mis-bound `this`)
  // - method identity is stable (`raw.furnsh === raw.furnsh`)
  // - hidden raw keys (`kind`, compat helpers) can be removed from the runtime raw surface
  const boundMethods = new Map<PropertyKey, Function>();
  const handler: ProxyHandler<BackendRuntimeSurface> = {
    get: (target, prop) => {
      if (isHiddenRawKey(prop)) {
        return undefined;
      }

      // Use `target` as the receiver so accessor/prototype lookups see
      // `this === target` (not the Proxy). Calls are still applied to `target`
      // below to preserve `this` binding for methods.
      const value = Reflect.get(target, prop, target) as unknown;

      if (prop === "kclear" && typeof value === "function") {
        const existing = boundMethods.get(prop);
        if (existing) {
          return existing;
        }
        const fn = value as unknown as () => void;
        const wrapped: SpiceBackend["kclear"] = () => {
          try {
            Reflect.apply(fn, target, []);
          } finally {
            byteBackedKernelPaths.clear();
          }
        };
        boundMethods.set(prop, wrapped);
        return wrapped;
      }

      if (typeof value === "function") {
        const existing = boundMethods.get(prop);
        if (existing) {
          return existing;
        }
        const fn = value as unknown as (...args: unknown[]) => unknown;
        const wrapped = (...args: unknown[]) => Reflect.apply(fn, target, args);
        boundMethods.set(prop, wrapped);
        return wrapped;
      }

      return value;
    },

    has: (target, prop) => {
      if (isHiddenRawKey(prop)) return false;
      return Reflect.has(target, prop);
    },

    ownKeys: (target) => Reflect.ownKeys(target).filter((key) => !isHiddenRawKey(key)),

    getOwnPropertyDescriptor: (target, prop) => {
      if (isHiddenRawKey(prop)) return undefined;
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  };

  const raw: SpiceBackend = new Proxy(backend, handler) as unknown as SpiceBackend;
  const kit = createKit(raw, { byteBackedKernelPaths, compatHelpers: backend });

  return {
    kind: backend.kind,
    raw,
    kit,
  };
}

function promisifyApi<T extends object>(target: T): PromisifyObject<T> {
  const wrappedByFn = new WeakMap<Function, Function>();
  const handler: ProxyHandler<T> = {
    get: (t, prop) => {
      const value = Reflect.get(t, prop, t) as unknown;

      if (typeof value === "function") {
        const fn = value as unknown as (...args: unknown[]) => unknown;
        const existing = wrappedByFn.get(fn);
        if (existing) {
          return existing;
        }

        const wrapped = (...args: unknown[]) => {
          try {
            return Promise.resolve(Reflect.apply(fn, t, args));
          } catch (err) {
            return Promise.reject(err);
          }
        };
        wrappedByFn.set(fn, wrapped);
        return wrapped;
      }

      return value;
    },
  };

  return new Proxy(target, handler) as PromisifyObject<T>;
}

/**
 * Create an async client with the same surface area as `createSpice()`, but
 * with all methods returning `Promise`s.
 */
export async function createSpiceAsync(
  options: CreateSpiceAsyncOptions,
): Promise<SpiceAsync> {
  const { kind, raw, kit } = await createSpice(options);

  return {
    kind,
    raw: promisifyApi(raw),
    kit: promisifyApi(kit),
  };
}
