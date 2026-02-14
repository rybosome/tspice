import type { KernelPack, KernelPackKernel } from "./kernelPack.js";
import { defaultKernelPathFromUrl } from "./defaultKernelPathFromUrl.js";


function ensureTrailingSlash(base: string): string {
  if (base === "") return "";
  return base.endsWith("/") ? base : `${base}/`;
}

const ABSOLUTE_URL_RE = /^[A-Za-z][A-Za-z\d+.-]*:/;

function isAbsoluteKernelUrlPrefix(kernelUrlPrefix: string): boolean {
  return ABSOLUTE_URL_RE.test(kernelUrlPrefix) || kernelUrlPrefix.startsWith("//");
}

// --- NAIF generic_kernels catalog ---

const DEFAULT_NAIF_KERNEL_URL_PREFIX = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/";
const DEFAULT_NAIF_PATH_BASE = "naif/";

const NAIF_KERNELS = {
  // Load order matters (LSK -> PCK -> SPK).
  naif0012_tls: { leafPath: "lsk/naif0012.tls", order: 0 },
  pck00011_tpc: { leafPath: "pck/pck00011.tpc", order: 1 },
  de432s_bsp: { leafPath: "spk/planets/de432s.bsp", order: 2 },
} as const;

export type NaifKernelId = keyof typeof NAIF_KERNELS;
export type NaifKernelLeafPath = (typeof NAIF_KERNELS)[NaifKernelId]["leafPath"];

const NAIF_KERNEL_IDS_SORTED = (Object.keys(NAIF_KERNELS) as NaifKernelId[]).sort(
  (a, b) => NAIF_KERNELS[a].order - NAIF_KERNELS[b].order,
);

const NAIF_ID_BY_LEAF_PATH: Record<NaifKernelLeafPath, NaifKernelId> = {
  "lsk/naif0012.tls": "naif0012_tls",
  "pck/pck00011.tpc": "pck00011_tpc",
  "spk/planets/de432s.bsp": "de432s_bsp",
};

export type KernelsNaifOptions = {
  /**
   * Prefix used to build each `kernel.url` entry (defaults to NAIF's `generic_kernels` host).
   *
   * This is a *build-time* prefix that's concatenated with each kernel leaf path.
   *
   * If you want kernel URLs to be relative (so they can be rooted at load time via `baseUrl`),
   * use a relative prefix like `kernels/naif/`.
   */
  kernelUrlPrefix?: string;

  /** Base virtual path used when loading kernels into tspice. */
  pathBase?: string;

  /**
   * Optional directory-style base used at *load time* to resolve relative kernel URLs.
   *
   * This becomes `KernelPack.baseUrl`.
   */
  baseUrl?: string;
};

export type NaifKernelsBuilder = {
  naif0012_tls(): NaifKernelsBuilder;
  pck00011_tpc(): NaifKernelsBuilder;
  de432s_bsp(): NaifKernelsBuilder;

  /** Add by typed kernel id. */
  add(id: NaifKernelId): NaifKernelsBuilder;
  /** Add by typed NAIF leaf path (e.g. `"lsk/naif0012.tls"`). */
  file(path: NaifKernelLeafPath): NaifKernelsBuilder;

  pack(): KernelPack;
};

function buildNaifKernel(
  id: NaifKernelId,
  opts: { kernelUrlPrefix: string; pathBase: string },
): KernelPackKernel {
  const leafPath = NAIF_KERNELS[id].leafPath;
  return {
    url: `${opts.kernelUrlPrefix}${leafPath}`,
    path: `${opts.pathBase}${leafPath}`,
  };
}

function createNaifBuilder(state: {
  selected: ReadonlySet<NaifKernelId>;
  opts: { kernelUrlPrefix: string; pathBase: string; baseUrl?: string };
}): NaifKernelsBuilder {
  let builder!: NaifKernelsBuilder;

  const add = (id: NaifKernelId): NaifKernelsBuilder => {
    if (state.selected.has(id)) return builder;
    const next = new Set(state.selected);
    next.add(id);
    return createNaifBuilder({ ...state, selected: next });
  };

  builder = {
    naif0012_tls: () => add("naif0012_tls"),
    pck00011_tpc: () => add("pck00011_tpc"),
    de432s_bsp: () => add("de432s_bsp"),

    add: (id) => add(id),
    file: (path) => add(NAIF_ID_BY_LEAF_PATH[path]),

    pack: () => ({
      ...(state.opts.baseUrl === undefined ? {} : { baseUrl: state.opts.baseUrl }),
      kernels: NAIF_KERNEL_IDS_SORTED.filter((id) => state.selected.has(id)).map((id) =>
        buildNaifKernel(id, state.opts),
      ),
    }),
  };

  return builder;
}

// --- Custom kernels ---

export type KernelsCustomOptions = {
  /** Optional directory-style base used to resolve relative kernel URLs at load time. */
  baseUrl?: string;
};

export type CustomKernelsBuilder = {
  add(kernel: { url: string; path?: string }): CustomKernelsBuilder;
  pack(): KernelPack;
};


function createCustomBuilder(state: {
  kernels: readonly KernelPackKernel[];
  baseUrl?: string;
}): CustomKernelsBuilder {
  let builder!: CustomKernelsBuilder;

  builder = {
    add: (kernel) =>
      createCustomBuilder({
        ...state,
        kernels: state.kernels.concat({
          url: kernel.url,
          path: kernel.path ?? defaultKernelPathFromUrl(kernel.url),
        }),
      }),
    pack: () => ({
      ...(state.baseUrl === undefined ? {} : { baseUrl: state.baseUrl }),
      kernels: state.kernels,
    }),
  };

  return builder;
}

export const kernels = {
  naif: (opts?: KernelsNaifOptions): NaifKernelsBuilder => {
    const rawKernelUrlPrefix = opts?.kernelUrlPrefix;
    const kernelUrlPrefix = ensureTrailingSlash(
      rawKernelUrlPrefix?.trim() ? rawKernelUrlPrefix.trim() : DEFAULT_NAIF_KERNEL_URL_PREFIX,
    );

    const rawPathBase = opts?.pathBase;
    const pathBase = ensureTrailingSlash(
      rawPathBase?.trim() ? rawPathBase.trim() : DEFAULT_NAIF_PATH_BASE,
    );

    const rawBaseUrl = opts?.baseUrl;
    const baseUrl =
      isAbsoluteKernelUrlPrefix(kernelUrlPrefix) || !rawBaseUrl?.trim() ? undefined : rawBaseUrl.trim();

    return createNaifBuilder({
      selected: new Set(),
      opts: {
        kernelUrlPrefix,
        pathBase,
        ...(baseUrl === undefined ? {} : { baseUrl }),
      },
    });
  },

  custom: (opts?: KernelsCustomOptions): CustomKernelsBuilder => {
    const baseUrl = opts?.baseUrl?.trim();
    return createCustomBuilder({
      kernels: [],
      ...(baseUrl ? { baseUrl } : {}),
    });
  },
} as const;
