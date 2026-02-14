import type { KernelPack } from "./kernelPack.js";
import { kernels } from "./kernels.js";

export type PublicKernelId = "naif0012_tls" | "pck00011_tpc" | "de432s_bsp";

export type CreatePublicKernelsOptions = {
  /** Base URL/path where the kernel files are hosted (defaults to `kernels/naif/`). */
  urlBase?: string;
  /** Base virtual path used when loading kernels into tspice (defaults to `naif/`). */
  pathBase?: string;
  /** Optional directory-style base used to resolve relative kernel URLs at load time. */
  baseUrl?: string;
};

export type PublicKernelsBuilder = {
  naif0012_tls(): PublicKernelsBuilder;
  pck00011_tpc(): PublicKernelsBuilder;
  de432s_bsp(): PublicKernelsBuilder;
  pack(): KernelPack;
};

export function createPublicKernels(opts?: CreatePublicKernelsOptions): PublicKernelsBuilder {
  // Legacy shim: the new recommended API is `kernels.naif/custom`.

  // Treat trimmed-empty as omitted so this wrapper's defaults still apply when
  // these values are sourced from env/config.
  const rawUrlBase = opts?.urlBase;
  const urlBase = rawUrlBase?.trim() ? rawUrlBase.trim() : "kernels/naif/";

  const rawPathBase = opts?.pathBase;
  const pathBase = rawPathBase?.trim() ? rawPathBase.trim() : "naif/";

  const baseUrl = opts?.baseUrl?.trim();

  return kernels.naif({
    urlBase,
    pathBase,
    ...(baseUrl ? { baseUrl } : {}),
  });
}

export const publicKernels: PublicKernelsBuilder = createPublicKernels();
