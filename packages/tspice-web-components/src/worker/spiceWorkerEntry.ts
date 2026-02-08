import { createSpiceAsync } from "@rybosome/tspice";

import type { SpiceTransport } from "../types.js";
import { exposeTransportToWorker } from "./exposeTransportToWorker.js";

const isSafeRpcKey = (key: string): boolean => /^[A-Za-z_$][\w$]*$/.test(key);

function createSpiceTransportFromSpiceAsync(spice: unknown): SpiceTransport {
  return {
    request: async (op: string, args: unknown[]): Promise<unknown> => {
      const dot = op.indexOf(".");
      if (dot <= 0 || dot === op.length - 1) {
        throw new Error(`Invalid op: ${op}`);
      }

      const namespace = op.slice(0, dot);
      const method = op.slice(dot + 1);

      if (namespace !== "raw" && namespace !== "kit") {
        throw new Error(`Unknown namespace: ${namespace}`);
      }

      if (!isSafeRpcKey(method)) {
        throw new Error(`Invalid method name: ${method}`);
      }

      const target = (spice as any)[namespace];
      const fn = target?.[method];
      if (typeof fn !== "function") {
        throw new Error(`Unknown op: ${op}`);
      }

      return await fn(...args);
    },
  };
}

void (async () => {
  // NOTE: This file is meant to be loaded as a Web Worker module.
  // It intentionally has no exports and runs as a side-effect.
  const spice = await createSpiceAsync({ backend: "wasm" });

  const transport = createSpiceTransportFromSpiceAsync(spice);

  exposeTransportToWorker({
    transport,
    onDispose: async () => {
      // Best-effort cleanup. Worker termination also releases resources, but
      // this helps callers who keep the worker alive.
      try {
        await (spice as any).raw?.kclear?.();
      } catch {
        // ignore
      }
    },
  });
})();
