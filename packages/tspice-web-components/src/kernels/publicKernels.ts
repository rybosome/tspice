import type { KernelPack, KernelPackKernel } from "./kernelPack.js";

export type PublicKernelId = "naif0012_tls" | "pck00011_tpc" | "de432s_bsp";

const PUBLIC_KERNELS: Record<PublicKernelId, { fileName: string; order: number }> = {
  // Load order matters (LSK -> PCK -> SPK).
  naif0012_tls: { fileName: "naif0012.tls", order: 0 },
  pck00011_tpc: { fileName: "pck00011.tpc", order: 1 },
  de432s_bsp: { fileName: "de432s.bsp", order: 2 },
};

function ensureTrailingSlash(base: string): string {
  if (base === "") return "";
  return base.endsWith("/") ? base : `${base}/`;
}

export type CreatePublicKernelsOptions = {
  /** Base URL/path where the kernel files are hosted (defaults to `kernels/naif/`). */
  urlBase?: string;
  /** Base virtual path used when loading kernels into tspice (defaults to `naif/`). */
  pathBase?: string;
};

export type PublicKernelsBuilder = {
  naif0012_tls(): PublicKernelsBuilder;
  pck00011_tpc(): PublicKernelsBuilder;
  de432s_bsp(): PublicKernelsBuilder;
  pack(): KernelPack;
};

function buildKernel(id: PublicKernelId, opts: Required<CreatePublicKernelsOptions>): KernelPackKernel {
  const fileName = PUBLIC_KERNELS[id].fileName;
  return {
    url: `${opts.urlBase}${fileName}`,
    path: `${opts.pathBase}${fileName}`,
  };
}

function createBuilder(state: {
  selected: ReadonlySet<PublicKernelId>;
  opts: Required<CreatePublicKernelsOptions>;
}): PublicKernelsBuilder {
  const add = (id: PublicKernelId): PublicKernelsBuilder => {
    if (state.selected.has(id)) return createBuilder(state);

    const next = new Set(state.selected);
    next.add(id);
    return createBuilder({ ...state, selected: next });
  };

  return {
    naif0012_tls: () => add("naif0012_tls"),
    pck00011_tpc: () => add("pck00011_tpc"),
    de432s_bsp: () => add("de432s_bsp"),
    pack: () => ({
      kernels: (Object.keys(PUBLIC_KERNELS) as PublicKernelId[])
        .sort((a, b) => PUBLIC_KERNELS[a].order - PUBLIC_KERNELS[b].order)
        .filter((id) => state.selected.has(id))
        .map((id) => buildKernel(id, state.opts)),
    }),
  };
}

export function createPublicKernels(opts?: CreatePublicKernelsOptions): PublicKernelsBuilder {
  const normalized: Required<CreatePublicKernelsOptions> = {
    urlBase: ensureTrailingSlash(opts?.urlBase ?? "kernels/naif/"),
    pathBase: ensureTrailingSlash(opts?.pathBase ?? "naif/"),
  };

  return createBuilder({ selected: new Set(), opts: normalized });
}

export const publicKernels: PublicKernelsBuilder = createPublicKernels();
