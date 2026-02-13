import type { WorkerLike } from "../transport/createWorkerTransport.js";

import { SPICE_WORKER_INLINE_SOURCE } from "./spiceWorkerInlineSource.js";

export type CreateSpiceWorkerOptions = {
  /** Override the worker entrypoint (advanced). */
  url?: string | URL;

  /**
   * Override the WASM binary URL used by the default inline worker.
   *
   * When omitted, `createSpiceWorker()` will resolve the WASM binary URL
   * relative to the published package layout.
   */
  wasmUrl?: string | URL;

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
  // ESM-only dependencies.
  const workerOptions: Record<string, unknown> = {
    type: "module",
    ...(opts.workerOptions ?? {}),
  };

  if (opts.url != null) {
    return new (WorkerCtor as WorkerCtorLike)(opts.url, workerOptions);
  }

  // Inline (blob) worker by default.
  //
  // This avoids requiring consumers to separately bundle/host a worker JS asset
  // URL. It also means the worker entry cannot use `import.meta.url` to locate
  // assets, since the entrypoint URL will be `blob:`.
  if (workerOptions.type !== "module") {
    throw new Error(
      'createSpiceWorker() inline worker requires a module worker (workerOptions.type="module")',
    );
  }

  const wasmUrl =
    opts.wasmUrl?.toString() ??
    // Published package layout (and what `build:dist-publish` produces):
    //   dist/worker/browser/createSpiceWorker.js
    //   backend-wasm/dist/tspice_backend_wasm.wasm
    new URL(
      "../../../backend-wasm/dist/tspice_backend_wasm.wasm",
      import.meta.url,
    ).href;

  const workerSource =
    `globalThis.__TSPICE_WORKER_CONFIG__ = ${JSON.stringify({ wasmUrl })};\n` +
    SPICE_WORKER_INLINE_SOURCE;

  const blob = new Blob([workerSource], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    return new (WorkerCtor as WorkerCtorLike)(blobUrl, workerOptions);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
