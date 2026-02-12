import type { SpiceBackend } from "@rybosome/tspice";

type DispatchFn = (backend: SpiceBackend, args: unknown[]) => unknown;

const DISPATCH: Record<string, DispatchFn> = {
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
};

export function dispatchCall(backend: SpiceBackend, call: string, args: unknown[]): unknown {
  const fn = DISPATCH[call];
  if (!fn) {
    const known = Object.keys(DISPATCH).sort();
    throw new Error(
      `Unsupported benchmark call ${JSON.stringify(call)}. ` +
        `Known calls: ${known.map((s) => JSON.stringify(s)).join(", ")}`,
    );
  }

  return fn(backend, args);
}
