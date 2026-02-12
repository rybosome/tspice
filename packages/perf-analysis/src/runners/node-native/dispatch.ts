import type { SpiceBackend } from "@rybosome/tspice";

type DispatchFn = (backend: SpiceBackend, args: unknown[]) => unknown;

const DISPATCH = {
  // Start minimal and grow this surface as suites expand.
  "time.str2et": (backend, args) => {
    if (typeof args[0] !== "string") {
      throw new TypeError(
        `time.str2et expects args[0] to be a string (got ${JSON.stringify(args[0])})`,
      );
    }
    return backend.str2et(args[0]);
  },

  // Convenience alias.
  str2et: (backend, args) => {
    if (typeof args[0] !== "string") {
      throw new TypeError(
        `str2et expects args[0] to be a string (got ${JSON.stringify(args[0])})`,
      );
    }
    return backend.str2et(args[0]);
  },
} satisfies Record<string, DispatchFn>;

export type NodeNativeBenchCall = keyof typeof DISPATCH;

export function assertNodeNativeBenchCall(value: string, label: string): NodeNativeBenchCall {
  const call = value.trim();
  if (call === "") {
    throw new TypeError(`${label} must be a non-empty string (got ${JSON.stringify(value)})`);
  }

  if (!Object.prototype.hasOwnProperty.call(DISPATCH, call)) {
    const known = Object.keys(DISPATCH).sort();
    throw new Error(
      `${label} must be a supported benchmark call (got ${JSON.stringify(call)}). ` +
        `Known calls: ${known.map((s) => JSON.stringify(s)).join(", ")}`,
    );
  }

  return call as NodeNativeBenchCall;
}

export function dispatchCall(backend: SpiceBackend, call: NodeNativeBenchCall, args: unknown[]): unknown {
  return DISPATCH[call](backend, args);
}
