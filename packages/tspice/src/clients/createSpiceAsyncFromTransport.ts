import type { SpiceAsync } from "../kit/types/spice-types.js";

import type { SpiceTransport } from "../transport/types.js";

type MethodKeys<T extends object> = Extract<{
  [K in keyof T]-?: T[K] extends (...args: unknown[]) => unknown ? K : never;
}[keyof T], string>;

type SurfaceMethodKeySnapshot = {
  /** Surface snapshot to avoid exposing phantom RPC methods via property access. */
  raw: ReadonlySet<MethodKeys<SpiceAsync["raw"]>>;
  /** Surface snapshot to avoid exposing phantom RPC methods via property access. */
  kit: ReadonlySet<MethodKeys<SpiceAsync["kit"]>>;
};

const blockedStringKeys = new Set<string>([
  // Prototype / constructor escapes
  "__proto__",
  "prototype",
  "constructor",

  // Common stringification / inspection hooks
  "toJSON",
  "inspect",

  // Object.prototype keys (avoid accidental RPC calls during introspection)
  "toLocaleString",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);

const isSafeRpcKey = (key: string): boolean => /^[A-Za-z_$][\w$]*$/.test(key);

function createNamespacedProxy(
  t: SpiceTransport,
  namespace: "raw" | "kit",
  knownMethodKeys?: ReadonlySet<string>,
): Record<string, unknown> {
  // Use a null-prototype target to reduce surprising Object.prototype behavior.
  const target = Object.create(null) as Record<string, unknown>;

  // Cache a bounded number of generated method wrappers so repeated property
  // access returns a stable function identity without allowing unbounded
  // growth from arbitrary/dynamic property names.
  const MAX_FN_CACHE_ENTRIES = 1024;
  const fnCache = new Map<string, unknown>();

  const toString = (): string => `[SpiceAsync.${namespace}]`;
  const valueOf = function (this: unknown): unknown {
    return this;
  };

  const inspectCustom = Symbol.for("nodejs.util.inspect.custom");

  const getOrCreateRpcFn = (prop: string): ((...args: unknown[]) => Promise<unknown>) => {
    const cached = fnCache.get(prop);
    // `fnCache` only stores functions, so `undefined` is a safe miss sentinel.
    if (cached !== undefined) {
      // LRU: bump recency by reinserting.
      fnCache.delete(prop);
      fnCache.set(prop, cached);
      return cached as (...args: unknown[]) => Promise<unknown>;
    }

    const fn = (...args: unknown[]) => t.request(`${namespace}.${prop}`, args);

    if (fnCache.size >= MAX_FN_CACHE_ENTRIES) {
      const oldest = fnCache.keys().next().value as string | undefined;
      if (oldest !== undefined) fnCache.delete(oldest);
    }

    fnCache.set(prop, fn);
    return fn;
  };

  const isKnownMethodKey = (prop: string): boolean => {
    if (!isSafeRpcKey(prop)) return false;
    if (knownMethodKeys && !knownMethodKeys.has(prop)) return false;
    return true;
  };

  return new Proxy(target, {
    get(_target, prop) {
      // Prevent the proxy from being treated as a thenable.
      if (prop === "then") return undefined;

      // Support a little bit of safe introspection.
      if (prop === Symbol.toStringTag) return `SpiceAsync.${namespace}`;
      if (prop === inspectCustom) return toString;

      if (typeof prop !== "string") return undefined;

      // Avoid remote calls via common introspection / dangerous keys.
      if (blockedStringKeys.has(prop)) return undefined;
      if (prop === "toString") return toString;
      if (prop === "valueOf") return valueOf;

      // Static, non-function backend properties (e.g. `raw.kind`).
      //
      // `createSpiceAsyncFromTransport()` is used by higher-level builders that
      // know these values up-front (in-process / worker modes), and can define
      // them via `Object.defineProperty(spice.raw, "kind", { value: ... })`.
      if (namespace === "raw" && prop === "kind") {
        if (Object.prototype.hasOwnProperty.call(_target, prop)) {
          return (_target as Record<string, unknown>)[prop];
        }
      }

      if (!isKnownMethodKey(prop)) return undefined;

      return getOrCreateRpcFn(prop);
    },

    has(_target, prop) {
      if (prop === Symbol.toStringTag) return true;
      if (prop === inspectCustom) return true;

      if (typeof prop !== "string") return false;
      if (prop === "toString" || prop === "valueOf") return true;
      if (blockedStringKeys.has(prop)) return false;

      if (namespace === "raw" && prop === "kind") {
        return Object.prototype.hasOwnProperty.call(_target, prop);
      }

      return isKnownMethodKey(prop);
    },

    ownKeys(_target) {
      const out: (string | symbol)[] = [];
      const seen = new Set<string | symbol>();
      const push = (key: string | symbol): void => {
        if (seen.has(key)) return;
        seen.add(key);
        out.push(key);
      };

      for (const key of Reflect.ownKeys(_target)) {
        push(key);
      }

      if (knownMethodKeys) {
        for (const key of knownMethodKeys) {
          if (blockedStringKeys.has(key)) continue;
          if (!isSafeRpcKey(key)) continue;
          push(key);
        }
      }

      return out;
    },

    getOwnPropertyDescriptor(_target, prop) {
      const own = Reflect.getOwnPropertyDescriptor(_target, prop);
      if (own) return own;

      if (typeof prop !== "string") return undefined;
      if (blockedStringKeys.has(prop)) return undefined;
      if (prop === "toString" || prop === "valueOf") {
        return {
          configurable: true,
          enumerable: false,
          writable: false,
          value: prop === "toString" ? toString : valueOf,
        };
      }
      if (!isKnownMethodKey(prop)) return undefined;

      return {
        configurable: true,
        enumerable: true,
        writable: false,
        value: getOrCreateRpcFn(prop),
      };
    },
  });
}

/** Create an async {@link SpiceAsync} client that forwards calls over a {@link SpiceTransport}. */
export function createSpiceAsyncFromTransport(
  t: SpiceTransport,
  surfaceMethodKeys?: SurfaceMethodKeySnapshot,
): SpiceAsync {
  const rawMethodKeys = surfaceMethodKeys?.raw;
  const kitMethodKeys = surfaceMethodKeys?.kit;

  return {
    raw: createNamespacedProxy(t, "raw", rawMethodKeys) as SpiceAsync["raw"],
    kit: createNamespacedProxy(t, "kit", kitMethodKeys) as SpiceAsync["kit"],
  };
}
