import type { Spice } from "../kit/types/spice-types.js";

import type { SpiceTransportSync } from "../transport/types.js";

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
  t: SpiceTransportSync,
  namespace: "raw" | "kit",
): Record<string, unknown> {
  // Use a null-prototype target to reduce surprising Object.prototype behavior.
  const target = Object.create(null) as Record<string, unknown>;

  // Cache a bounded number of generated method wrappers so repeated property
  // access returns a stable function identity without allowing unbounded
  // growth from arbitrary/dynamic property names.
  const MAX_FN_CACHE_ENTRIES = 1024;
  type RpcFn = (...args: unknown[]) => unknown;
  const fnCache = new Map<string, RpcFn>();

  const toString = (): string => `[SpiceSync.${namespace}]`;
  const valueOf = function (this: unknown): unknown {
    return this;
  };

  const inspectCustom = Symbol.for("nodejs.util.inspect.custom");

  return new Proxy(target, {
    get(_target, prop) {
      // Prevent the proxy from being treated as a thenable.
      if (prop === "then") return undefined;

      // Support a little bit of safe introspection.
      if (prop === Symbol.toStringTag) return `SpiceSync.${namespace}`;
      if (prop === inspectCustom) return toString;

      if (typeof prop !== "string") return undefined;

      // Avoid remote calls via common introspection / dangerous keys.
      if (blockedStringKeys.has(prop)) return undefined;
      if (prop === "toString") return toString;
      if (prop === "valueOf") return valueOf;

      // Static, non-function backend properties (e.g. `raw.kind`).
      //
      // Higher-level builders can define these via
      // `Object.defineProperty(spice.raw, "kind", { value: ... })`.
      if (namespace === "raw" && prop === "kind") {
        if (Object.prototype.hasOwnProperty.call(_target, prop)) {
          return (_target as Record<string, unknown>)[prop];
        }
      }

      if (!isSafeRpcKey(prop)) return undefined;

      if (fnCache.has(prop)) {
        const cached = fnCache.get(prop)!;
        // LRU: bump recency by reinserting.
        fnCache.delete(prop);
        fnCache.set(prop, cached);
        return cached;
      }

      const fn = (...args: unknown[]) => t.request(`${namespace}.${prop}`, args);

      if (fnCache.size >= MAX_FN_CACHE_ENTRIES) {
        const oldest = fnCache.keys().next().value as string | undefined;
        if (oldest !== undefined) fnCache.delete(oldest);
      }

      fnCache.set(prop, fn);
      return fn;
    },
  });
}

/** Create a sync {@link Spice} client that forwards calls over a {@link SpiceTransportSync}. */
export function createSpiceSyncFromTransport(t: SpiceTransportSync): Spice {
  return {
    raw: createNamespacedProxy(t, "raw") as unknown as Spice["raw"],
    kit: createNamespacedProxy(t, "kit") as unknown as Spice["kit"],
  };
}
