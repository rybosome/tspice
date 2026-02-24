import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

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
  backendInstance?: SpiceBackend;
};

export type CreateSpiceAsyncOptions = CreateSpiceOptions;

function createRawApi(
  backend: SpiceBackend,
  byteBackedKernelPaths: Set<string>,
): Spice["raw"] {
  // Keep raw methods bound and preserve kclear bookkeeping synchronization.
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

  const rawSource = new Proxy(backend, handler) as SpiceBackend;

  // True breaking move from `raw` to `kit`: remove migrated helpers at raw
  // construction time (no raw proxy-hide/denylist compat layer).
  const {
    newIntCell: omittedNewIntCell,
    newDoubleCell: omittedNewDoubleCell,
    newCharCell: omittedNewCharCell,
    newWindow: omittedNewWindow,
    freeCell: omittedFreeCell,
    freeWindow: omittedFreeWindow,
    cellGeti: omittedCellGeti,
    cellGetd: omittedCellGetd,
    cellGetc: omittedCellGetc,
    spiceVersion: omittedSpiceVersion,
    readVirtualOutput: omittedReadVirtualOutput,
    ...raw
  } = rawSource;

  void [
    omittedNewIntCell,
    omittedNewDoubleCell,
    omittedNewCharCell,
    omittedNewWindow,
    omittedFreeCell,
    omittedFreeWindow,
    omittedCellGeti,
    omittedCellGetd,
    omittedCellGetc,
    omittedSpiceVersion,
    omittedReadVirtualOutput,
  ];

  return raw as Spice["raw"];
}

/**
 * Create a sync {@link Spice} client backed by the requested backend/transport.
 */
export async function createSpice(options: CreateSpiceOptions): Promise<Spice> {
  const backend = options.backendInstance ?? (await createBackend(options));

  // Track kernels loaded from bytes so `kit.unloadKernel()` can accept flexible
  // path forms (e.g. `/kernels/foo.tls`) across backends.
  const byteBackedKernelPaths = new Set<string>();

  const raw = createRawApi(backend, byteBackedKernelPaths);
  const kit = createKit(backend, { byteBackedKernelPaths });

  return { raw, kit };
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
  const { raw, kit } = await createSpice(options);

  return {
    raw: promisifyApi(raw),
    kit: promisifyApi(kit),
  };
}
