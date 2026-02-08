export function createSpiceWorker(
  opts: {
    /** Override the worker entrypoint (advanced). */
    url?: string | URL;
    /** Options passed through to the Worker constructor. */
    workerOptions?: WorkerOptions;
  } = {},
): Worker {
  if (typeof Worker === "undefined") {
    throw new Error("createSpiceWorker() requires Web Worker support in the current runtime");
  }

  const url = opts.url ?? new URL("./spiceWorkerEntry.js", import.meta.url);

  // Default to module workers since this package is ESM and relies on
  // `import.meta.url`-relative assets.
  const workerOptions: WorkerOptions = {
    type: "module",
    ...opts.workerOptions,
  };

  return new Worker(url, workerOptions);
}
