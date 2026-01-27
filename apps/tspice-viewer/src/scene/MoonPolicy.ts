import type { KernelPackId } from "../spice/loadKernelPack.js";
import type { BodyRegistryEntry } from "./BodyRegistry.js";

/**
* Encodes future viewer rules for whether a moon is eligible to render.
*
* Note: this is intentionally **not** wired into runtime behavior yet. It's a
* pure helper to keep the forthcoming rules in one place.
*/
export const MoonPolicy = {
  canRenderMoon: (input: {
    moon: BodyRegistryEntry;
    loadedKernelPacks: ReadonlySet<KernelPackId>;
  }): boolean => {
    const { moon, loadedKernelPacks } = input;

    if (moon.kind !== "moon") return true;

    if (!moon.requiresKernelPack) return true;

    // In the future, moons may require extra ephemeris kernels beyond the baseline.
    if (!moon.kernelPackId) return false;

    return loadedKernelPacks.has(moon.kernelPackId);
  },
} as const;
