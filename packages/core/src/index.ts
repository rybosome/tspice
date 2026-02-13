export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}

/**
* Assert that a condition is truthy.
*
* Throws {@link InvariantError} when the assertion fails.
*/
export function invariant(condition: unknown, message = "Invariant violation"): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}

/**
* Exhaustiveness helper for `switch` statements.
*
* Throws an error if called.
*/
export function assertNever(value: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${String(value)}`);
}

/**
* Normalize a *virtual* kernel identifier so the same `path` works across backends
* (Node temp-file staging vs WASM `/kernels/...` FS).
*
* This is intentionally stricter than general filesystem normalization:
* - `..` is rejected
* - leading slashes and `kernels/` prefixes are stripped
* - repeated slashes and `.` segments are collapsed
*/
export function normalizeVirtualKernelPath(input: string): string {
  // NOTE: Avoid `String.prototype.replaceAll` for compatibility with older
  // JS runtimes / conservative build targets.
  const raw = input.replace(/\\/g, "/").trim();
  if (!raw) {
    throw new Error("Kernel path must be non-empty");
  }

  // Strip leading slashes so `/kernels/foo.tls` behaves like `kernels/foo.tls`.
  let rel = raw.replace(/^\/+/, "");

  // Strip leading `./` segments.
  while (rel.startsWith("./")) {
    rel = rel.slice(2);
  }

  // Strip a leading `kernels/` directory to keep user input flexible.
  // Treat a bare `kernels` segment as equivalent to `kernels/`.
  if (rel === "kernels") {
    rel = "";
  }
  while (rel.startsWith("kernels/")) {
    rel = rel.replace(/^kernels\/+/, "");
  }

  const segments = rel.split("/");
  const out: string[] = [];
  for (const seg of segments) {
    if (!seg || seg === ".") {
      continue;
    }
    if (seg === "..") {
      throw new Error(`Invalid kernel path (.. not allowed): ${input}`);
    }
    out.push(seg);
  }

  if (out.length === 0) {
    throw new Error(`Invalid kernel path: ${input}`);
  }

  return out.join("/");
}
