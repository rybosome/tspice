import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import type { CreateBackendOptions } from "./backend.js";
import { createBackend } from "./backend.js";

import type { Spice, SpiceAsync } from "./kit/types/spice-types.js";
import { createKit } from "./kit/spice/create-kit.js";

export type CreateSpiceOptions = CreateBackendOptions & {
  /**
   * If provided, `createSpice()` will wrap this backend instead of creating a new one.
   *
   * Useful for testing or advanced callers.
   */
  backendInstance?: SpiceBackend;
};

export type CreateSpiceAsyncOptions = CreateSpiceOptions;

export async function createSpice(options: CreateSpiceOptions): Promise<Spice> {
  const backend = options.backendInstance ?? (await createBackend(options));

  // Track kernels loaded from bytes so `kit.unloadKernel()` can accept flexible
  // path forms (e.g. `/kernels/foo.tls`) across backends.
  const byteBackedKernelPaths = new Set<string>();

  // Keep `raw.kclear()` and `kit`'s internal tracking in sync.
  //
  // Use a Proxy so:
  // - prototype methods aren't lost (object spread only copies own props)
  // - methods are bound to the original backend instance (avoid mis-bound `this`)
  // - method identity is stable (`raw.furnsh === raw.furnsh`)
  const boundMethods = new Map<PropertyKey, Function>();
  const handler: ProxyHandler<SpiceBackend> = {
    get: (target, prop) => {
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
  };

  const raw: SpiceBackend = new Proxy(backend, handler);
  const kit = createKit(raw, { byteBackedKernelPaths });

  return { raw, kit };
}

function promisifyApi<T extends object>(target: T): T {
  const boundMethods = new Map<PropertyKey, Function>();
  const handler: ProxyHandler<T> = {
    get: (t, prop) => {
      const value = Reflect.get(t, prop, t) as unknown;

      if (typeof value === "function") {
        const existing = boundMethods.get(prop);
        if (existing) {
          return existing;
        }

        const fn = value as unknown as (...args: unknown[]) => unknown;
        const wrapped = (...args: unknown[]) =>
          Promise.resolve().then(() => Reflect.apply(fn, t, args));
        boundMethods.set(prop, wrapped);
        return wrapped;
      }

      return value;
    },
  };

  return new Proxy(target, handler);
}

/**
* Create an async client with the same surface area as `createSpice()`, but
* with all methods returning `Promise`s.
*/
export async function createSpiceAsync(
  options: CreateSpiceAsyncOptions,
): Promise<SpiceAsync> {
  const { raw, kit } = await createSpice(options);

  return {
    raw: promisifyApi(raw) as unknown as SpiceAsync["raw"],
    kit: promisifyApi(kit) as unknown as SpiceAsync["kit"],
  };
}
