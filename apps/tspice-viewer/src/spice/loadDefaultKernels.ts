import type { Spice } from "@rybosome/tspice";

import { naifGenericKernelPack } from "./kernelPacks/naifGeneric.js";
import { loadKernelPack } from "./loadKernelPack.js";

/**
* Loads the viewer's default NAIF kernels into the provided tspice instance.
*
* Load order matters:
* - LSK (leap seconds)
* - PCK (planetary constants)
* - SPK (ephemeris)
*/
export async function loadDefaultKernels(spice: Spice): Promise<void> {
  await loadKernelPack(spice, naifGenericKernelPack);
}
