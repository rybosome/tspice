import type { KernelPack } from "../loadKernelPack.js";

/**
 * Generated comet ephemerides (helio-centric, J2000).
 *
 * See `scripts/generate-comet-kernels.py` for generation details.
 */
export const cometsKernelPack: KernelPack = {
  id: "comets",
  kernels: [
    {
      urlPath: "kernels/comets/comets_1950_2050_step5d.bsp",
      fsPath: "/kernels/comets/comets_1950_2050_step5d.bsp",
    },
  ],
} as const;
