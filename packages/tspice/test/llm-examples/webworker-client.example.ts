import { publicKernels, spiceClients } from "@rybosome/tspice";

type SpiceWebWorker = Awaited<ReturnType<typeof spiceClients.toWebWorker>>["spice"];

/**
 * Example: create an async WebWorker client in the browser.
 *
 * Notes:
 * - You usually do NOT need to manually construct a `new Worker(...)`. By default,
 *   `spiceClients.toWebWorker()` creates an internal inline blob-module worker.
 * - WebWorker clients are async: all `spice.kit.*` calls return Promises.
 */
export async function withWebWorkerClient<T>(
  fn: (spice: SpiceWebWorker) => Promise<T> | T,
): Promise<T> {
  const { spice, dispose } = await spiceClients.toWebWorker();

  try {
    // Example async kit call (no kernels required):
    await spice.kit.toolkitVersion();

    return await fn(spice);
  } finally {
    await dispose();
  }
}

/**
 * Example: use the public kernel builder to preload kernels before creating the worker client.
 *
 * `publicKernels`/`createPublicKernels()` produces a `KernelPack`, which you pass to
 * `spiceClients.withKernels(pack)` before calling `.toWebWorker()`.
 */
export async function createWebWorkerClientWithPublicKernels() {
  const pack = publicKernels
    .naif0012_tls()
    .pck00011_tpc()
    .de432s_bsp()
    .pack();

  const { spice, dispose } = await spiceClients
    .caching({ maxEntries: 10_000, ttlMs: null })
    .withKernels(pack, { baseUrl: import.meta.env.BASE_URL })
    .toWebWorker();

  try {
    // After loading an LSK, many time conversion APIs become usable.
    const utc = "2000 JAN 01 12:00:00";
    const et = await spice.kit.utcToEt(utc);
    const utcAgain = await spice.kit.etToUtc(et, "ISOC", 3);

    return { utc, et, utcAgain };
  } finally {
    await dispose();
  }
}
