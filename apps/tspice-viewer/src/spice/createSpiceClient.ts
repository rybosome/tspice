import { createSpice, type Spice } from '@rybosome/tspice'

import type { EtSeconds, SpiceClient } from './SpiceClient.js'
import { createCachedSpiceClient } from './createCachedSpiceClient.js'
import { TspiceSpiceClient } from './TspiceSpiceClient.js'
import { naifGenericKernelPack } from './kernelPacks/naifGeneric.js'
import { loadKernelPack } from './loadKernelPack.js'

export type ViewerSpiceClientBundle = {
  spice: Spice
  /** Cached client for per-frame rendering. */
  client: SpiceClient

  /** Uncached client for bulk sampling (orbit paths, etc). */
  rawClient: SpiceClient
  utcToEt(utc: string): EtSeconds
}

/**
 * Viewer entrypoint for initializing a tspice-backed `SpiceClient`.
 *
 * This app always uses the real WASM backend.
 */
export async function createSpiceClient(
  options: { searchParams?: URLSearchParams } = {},
): Promise<ViewerSpiceClientBundle> {
  // Keep URL parsing for other params (`?utc=...`, `?et=...`) in the caller.
  // Currently `searchParams` isn't used here, but we keep the option for API stability.
  void options

  const spice = await createSpice({ backend: 'wasm' })
  await loadKernelPack(spice, naifGenericKernelPack)

  const rawClient = new TspiceSpiceClient(spice)
  const client = createCachedSpiceClient(rawClient)

  return {
    spice,
    client,
    rawClient,
    utcToEt: (utc) => spice.kit.utcToEt(utc) as unknown as EtSeconds,
  }
}
