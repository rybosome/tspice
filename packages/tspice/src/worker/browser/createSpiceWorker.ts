import type { WorkerLike } from "../transport/createWorkerTransport.js";

export type CreateSpiceWorkerOptions = {
  /** Override the worker entrypoint (advanced). */
  url?: string | URL;
  /** Options passed through to the Worker constructor. */
  workerOptions?: Record<string, unknown>;
};

type WorkerCtorLike = new (
  url: string | URL,
  options?: Record<string, unknown>,
) => WorkerLike;

export function createSpiceWorker(opts: CreateSpiceWorkerOptions = {}): WorkerLike {
  const WorkerCtor = (globalThis as unknown as { Worker?: unknown }).Worker;

  if (typeof WorkerCtor !== "function") {
    throw new Error("createSpiceWorker() requires Web Worker support in the current runtime");
  }

  const url = opts.url ?? new URL("./spiceWorkerEntry.js", import.meta.url);

  // Default to module workers since this package is ESM and relies on
  // `import.meta.url`-relative assets.
  const workerOptions: Record<string, unknown> = {
    type: "module",
    ...(opts.workerOptions ?? {}),
  };

  return new (WorkerCtor as WorkerCtorLike)(url, workerOptions);
}
