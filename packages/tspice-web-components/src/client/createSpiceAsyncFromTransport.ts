import type { SpiceAsync } from "@rybosome/tspice";

import type { SpiceTransport } from "../types.js";

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

      if (!isSafeRpcKey(prop)) return undefined;

      if (fnCache.has(prop)) return fnCache.get(prop);

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

export function createSpiceAsyncFromTransport(t: SpiceTransport): SpiceAsync {
  return {
    raw: createNamespacedProxy(t, "raw") as SpiceAsync["raw"],
    kit: createNamespacedProxy(t, "kit") as SpiceAsync["kit"],
  };
}
