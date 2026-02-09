import type { SpiceAsync } from '@rybosome/tspice'

// Baseline packs are loaded up-front. Optional packs may be fetched later.
export type KernelPackId = 'naifGeneric' | 'moon-default'

export type KernelPackKernel = {
  urlPath: string
  fsPath: string
}

export type KernelPack = {
  id: KernelPackId
  kernels: readonly KernelPackKernel[]
}

async function fetchKernelBytes(url: URL): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch kernel: ${url.toString()} (status=${res.status})`)
  }
  return new Uint8Array(await res.arrayBuffer())
}

/**
 * Load the given kernel pack into the provided `tspice` instance.
 *
 * Fetching is done in parallel, but kernels are *loaded* in pack order.
 */
export async function loadKernelPack(spice: SpiceAsync, pack: KernelPack): Promise<void> {
  // In Vite, BASE_URL accounts for non-root deployments (e.g. GitHub pages).
  const base = new URL(import.meta.env.BASE_URL, window.location.href)

  const urls = pack.kernels.map((k) => new URL(k.urlPath, base))
  const bytes = await Promise.all(urls.map((u) => fetchKernelBytes(u)))

  for (let i = 0; i < pack.kernels.length; i++) {
    const kernel = pack.kernels[i]
    await spice.kit.loadKernel({ path: kernel.fsPath, bytes: bytes[i] })
  }
}
