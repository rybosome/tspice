import type { WorkerLike } from "../transport/createWorkerTransport.js";

export type CreateSpiceWorkerOptions = {
  /** Override the worker entrypoint (advanced). */
  url?: string | URL;
  /**
   * Options passed through to the `Worker` constructor.
   *
   * Typed loosely on purpose so this package doesn't require `lib.dom` types
   * (and so it can be consumed in non-DOM TS configs).
   */
  workerOptions?: Record<string, unknown>;
};

type WorkerCtorLike = new (
  url: string | URL,
  options?: Record<string, unknown>,
) => WorkerLike;

export function createSpiceWorker(
  opts: CreateSpiceWorkerOptions = {},
): WorkerLike {
  const WorkerCtor = (globalThis as unknown as { Worker?: unknown }).Worker;

  if (typeof WorkerCtor !== "function") {
    throw new Error(
      "createSpiceWorker() requires Web Worker support in the current runtime",
    );
  }

  // Default to module workers since this package is ESM and relies on
  // `import.meta.url`-relative assets.
  const workerOptions: Record<string, unknown> = {
    type: "module",
    ...(opts.workerOptions ?? {}),
  };

  if (opts.url != null) {
    return new (WorkerCtor as WorkerCtorLike)(opts.url, workerOptions);
  }

  // NOTE: Keep this inline (no intermediate `url` variable) so bundlers like
  // Vite/Rollup can statically detect the worker entry and bundle its module
  // graph.
  return new (WorkerCtor as WorkerCtorLike)(
    new URL("./spiceWorkerEntry.js", import.meta.url),
    workerOptions,
  );
}
