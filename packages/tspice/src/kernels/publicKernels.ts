import type { KernelPack, KernelPackKernel } from "./kernelPack.js";

export type PublicKernelId = "naif0012_tls" | "pck00011_tpc" | "de432s_bsp";

const PUBLIC_KERNELS: Record<PublicKernelId, { fileName: string; order: number }> = {
  // Load order matters (LSK -> PCK -> SPK).
  naif0012_tls: { fileName: "naif0012.tls", order: 0 },
  pck00011_tpc: { fileName: "pck00011.tpc", order: 1 },
  de432s_bsp: { fileName: "de432s.bsp", order: 2 },
};

const PUBLIC_KERNEL_IDS_SORTED = (Object.keys(PUBLIC_KERNELS) as PublicKernelId[]).sort(
  (a, b) => PUBLIC_KERNELS[a].order - PUBLIC_KERNELS[b].order,
);

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
  let builder!: PublicKernelsBuilder;

  const add = (id: PublicKernelId): PublicKernelsBuilder => {
    if (state.selected.has(id)) return builder;

    const next = new Set(state.selected);
    next.add(id);
    return createBuilder({ ...state, selected: next });
  };

  builder = {
    naif0012_tls: () => add("naif0012_tls"),
    pck00011_tpc: () => add("pck00011_tpc"),
    de432s_bsp: () => add("de432s_bsp"),
    pack: () => ({
      kernels: PUBLIC_KERNEL_IDS_SORTED
        .filter((id) => state.selected.has(id))
        .map((id) => buildKernel(id, state.opts)),
    }),
  };

  return builder;
}

/** Create a builder for selecting and packaging a minimal set of public NAIF kernels. */
export function createPublicKernels(opts?: CreatePublicKernelsOptions): PublicKernelsBuilder {
  const normalized: Required<CreatePublicKernelsOptions> = {
    urlBase: ensureTrailingSlash(opts?.urlBase ?? "kernels/naif/"),
    pathBase: ensureTrailingSlash(opts?.pathBase ?? "naif/"),
  };

  return createBuilder({ selected: new Set(), opts: normalized });
}

export const publicKernels: PublicKernelsBuilder = createPublicKernels();
