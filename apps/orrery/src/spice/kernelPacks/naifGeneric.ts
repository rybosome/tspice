import type { KernelPack } from '../loadKernelPack.js'

/**
 * Baseline NAIF kernel pack for the viewer.
 *
 * Load order matters:
 * - LSK (leap seconds)
 * - PCK (planetary constants)
 * - SPK (ephemeris)
 */
export const naifGenericKernelPack: KernelPack = {
  id: 'naifGeneric',
  kernels: [
    {
      urlPath: 'kernels/naif/naif0012.tls',
      fsPath: 'naif/naif0012.tls',
    },
    {
      urlPath: 'kernels/naif/pck00011.tpc',
      fsPath: 'naif/pck00011.tpc',
    },
    {
      urlPath: 'kernels/naif/de432s.bsp',
      fsPath: 'naif/de432s.bsp',
    },
  ],
} as const
