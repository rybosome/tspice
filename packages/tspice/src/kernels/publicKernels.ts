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
  const baseUrl = opts?.baseUrl;
  return kernels.naif({
    urlBase: opts?.urlBase ?? "kernels/naif/",
    pathBase: opts?.pathBase ?? "naif/",
    ...(baseUrl === undefined ? {} : { baseUrl }),
  });
}

export const publicKernels: PublicKernelsBuilder = createPublicKernels();
