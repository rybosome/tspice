import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import type { CreateBackendOptions } from "./backend.js";
import { createBackend } from "./backend.js";

import type {
  PromisifyObject,
  Spice,
  SpiceAsync,
  SpiceRaw,
} from "./kit/types/spice-types.js";
import { createKit } from "./kit/spice/create-kit.js";

const ekDisposers = new WeakMap<Spice | SpiceAsync, () => void>();
/** Internal client lifecycle hook for direct EK loads, which survive KCLEAR. */
export function releaseClientEkLoads(spice: Spice | SpiceAsync): void {
  ekDisposers.get(spice)?.();
}
export type CreateSpiceOptions = CreateBackendOptions & {
  /**
   * If provided, `createSpice()` will wrap this backend instead of creating a new one.
   *
   * Useful for testing or advanced callers.
   */
  backendInstance?: SpiceBackend;
};

export type CreateSpiceAsyncOptions = CreateSpiceOptions;

/**
 * Create a sync {@link Spice} client backed by the requested backend/transport.
 */
export async function createSpice(options: CreateSpiceOptions): Promise<Spice> {
  const backend = options.backendInstance ?? (await createBackend(options));

  // Track kernels loaded from bytes so `kit.unloadKernel()` can accept flexible
  // path forms (e.g. `/kernels/foo.tls`) across backends.
  const queryLoads = new Set<ReturnType<SpiceRaw["eklef"]>>();
  const byteBackedKernelPaths = new Set<string>();

  // Keep `raw.kclear()` and `kit`'s internal tracking in sync.
  //
  // Use a Proxy so:
  // - prototype methods aren't lost (object spread only copies own props)
  // - methods are bound to the original backend instance (avoid mis-bound `this`)
  // - method identity is stable (`raw.furnsh === raw.furnsh`)
  const boundMethods = new Map<PropertyKey, (...args: never[]) => unknown>();
  const internalHandler: ProxyHandler<SpiceBackend["raw"]> = {
    get: (target, prop) => {
      // Use `target` as the receiver so accessor/prototype lookups see
      // `this === target` (not the Proxy). Calls are still applied to `target`
      // below to preserve `this` binding for methods.
      const value = Reflect.get(target, prop, target) as unknown;

      if (prop === "eklef" || prop === "ekuef") {
        const existing = boundMethods.get(prop);
        if (existing) return existing;
        if (prop === "eklef") {
          const load = (path: string) => {
            const h = target.eklef(path);
            queryLoads.add(h);
            return h;
          };
          boundMethods.set(prop, load);
          return load;
        }
        const unload = (h: ReturnType<SpiceRaw["eklef"]>) => {
          target.ekuef(h);
          queryLoads.delete(h);
        };
        boundMethods.set(prop, unload);
        return unload;
      }
      if (prop === "kclear" && typeof value === "function") {
        const existing = boundMethods.get(prop);
        if (existing) {
          return existing;
        }
        const fn = value as unknown as () => void;
        const wrapped: SpiceBackend["raw"]["kclear"] = () => {
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

  const rawInternal = new Proxy(backend.raw, internalHandler);

  const raw = rawInternal as unknown as SpiceRaw;
  Object.defineProperty(raw, "kind", { value: backend.kind, enumerable: true });

  const kit = createKit(
    {
      kind: backend.kind,
      raw: rawInternal,
      kit: backend.kit,
    },
    { byteBackedKernelPaths },
  );

  const spice = { raw, kit };
  ekDisposers.set(spice, () => {
    for (const h of queryLoads) {
      try {
        backend.raw.ekuef(h);
      } catch {
        continue;
      }
      queryLoads.delete(h);
    }
  });
  return spice;
}

function promisifyApi<T extends object>(target: T): PromisifyObject<T> {
  const wrappedByFn = new WeakMap<
    (...args: never[]) => unknown,
    (...args: never[]) => unknown
  >();
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
  const sync = await createSpice(options);
  const asyncSpice = {
    raw: promisifyApi(sync.raw),
    kit: promisifyApi(sync.kit),
  };
  ekDisposers.set(asyncSpice, () => releaseClientEkLoads(sync));
  return asyncSpice;
}
