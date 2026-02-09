import type { SpiceAsync } from '@rybosome/tspice'
import { publicKernels, spiceClients } from '@rybosome/tspice'

export type ViewerSpiceClientBundle = {
  /** Cached client for per-frame rendering. */
  cachedSpice: SpiceAsync

  /**
   * Client for bulk sampling (orbit paths, etc).
   *
   * Note: the new `spiceClients` API no longer exposes a separate uncached
   * transport on the same worker, so for now this aliases `cachedSpice`.
   */
  uncachedSpice: SpiceAsync

  /** Terminate the underlying worker + cleanup transports. */
  dispose: () => void
}

/**
 * Viewer entrypoint for initializing a worker-backed `SpiceAsync` client.
 */
export async function createSpiceClient(
  options: { searchParams?: URLSearchParams } = {},
): Promise<ViewerSpiceClientBundle> {
  // Keep URL parsing for other params (`?utc=...`, `?et=...`) in the caller.
  // Currently `searchParams` isn't used here, but we keep the option for API stability.
  void options

  const pack = publicKernels.naif0012_tls().pck00011_tpc().de432s_bsp().pack()

  const { spice: cachedSpice, dispose: disposeAsync } = await spiceClients
    .caching({
      maxEntries: 10_000,

      // SPICE queries are deterministic for a given op+args, so LRU-only is
      // sufficient. (TimeStore quantization also keeps the key space sane.)
      ttlMs: null,
    })
    .withKernels(pack, {
      baseUrl: import.meta.env.BASE_URL,
    })
    .toWebWorker()

  const dispose = (): void => {
    void disposeAsync()
  }

  return {
    cachedSpice,
    uncachedSpice: cachedSpice,
    dispose,
  }
}
