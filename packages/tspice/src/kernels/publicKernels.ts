import type { KernelPack } from "./kernelPack.js";
import { kernels } from "./kernels.js";

export type PublicKernelId = "naif0012_tls" | "pck00011_tpc" | "de432s_bsp";

export type CreatePublicKernelsOptions = {
  /**
   * Prefix used to build each `kernel.url` entry (defaults to `kernels/naif/`).
   *
   * This is a compatibility wrapper over `kernels.naif()`; new code should use `kernels` directly.
   */
  kernelUrlPrefix?: string;

  /** Base virtual path used when loading kernels into tspice (defaults to `naif/`). */
  pathBase?: string;

  /**
   * Optional directory-style base used at *load time* to resolve relative kernel URLs.
   *
   * This becomes `KernelPack.baseUrl`.
   */
  baseUrl?: string;
};

export type PublicKernelsBuilder = {
  naif0012_tls(): PublicKernelsBuilder;
  pck00011_tpc(): PublicKernelsBuilder;
  de432s_bsp(): PublicKernelsBuilder;
  pack(): KernelPack;
};

/**
 * Create a builder for selecting and packaging a minimal set of public NAIF kernels.
 */
export function createPublicKernels(opts?: CreatePublicKernelsOptions): PublicKernelsBuilder {
  // Legacy shim: the new recommended API is `kernels.naif/custom`.

  // Treat trimmed-empty as omitted so this wrapper's defaults still apply when
  // these values are sourced from env/config.
  const rawKernelUrlPrefix = opts?.kernelUrlPrefix;
  const kernelUrlPrefix = rawKernelUrlPrefix?.trim() ? rawKernelUrlPrefix.trim() : "kernels/naif/";

  const rawPathBase = opts?.pathBase;
  const pathBase = rawPathBase?.trim() ? rawPathBase.trim() : "naif/";

  const baseUrl = opts?.baseUrl?.trim();

  return kernels.naif({
    kernelUrlPrefix,
    pathBase,
    ...(baseUrl ? { baseUrl } : {}),
  });
}

/** Default builder for the standard public NAIF kernels. */
export const publicKernels: PublicKernelsBuilder = createPublicKernels();
