import type { SpiceAsync } from "@rybosome/tspice";

import type { SpiceTransport } from "../types.js";

function createNamespacedProxy(
  t: SpiceTransport,
  namespace: "raw" | "kit",
): Record<string, unknown> {
  const fnCache = new Map<PropertyKey, unknown>();

  return new Proxy(
    {},
    {
      get(_target, prop) {
        // Prevent the proxy from being treated as a thenable.
        if (prop === "then") return undefined;

        const cached = fnCache.get(prop);
        if (cached !== undefined) return cached;

        if (typeof prop !== "string") return undefined;

        const fn = (...args: unknown[]) => t.request(`${namespace}.${prop}`, args);
        fnCache.set(prop, fn);
        return fn;
      },
    },
  );
}

export function createSpiceAsyncFromTransport(t: SpiceTransport): SpiceAsync {
  return {
    raw: createNamespacedProxy(t, "raw") as SpiceAsync["raw"],
    kit: createNamespacedProxy(t, "kit") as SpiceAsync["kit"],
  };
}
