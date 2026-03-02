import type { KernelPack, KernelPackKernel } from "./kernelPack.js";
import { defaultKernelPathFromUrl } from "./defaultKernelPathFromUrl.js";
import type { NaifKernelId } from "./naifKernelId.js";

function ensureTrailingSlash(base: string): string {
  if (base === "") return "";
  return base.endsWith("/") ? base : `${base}/`;
}

const ABSOLUTE_URL_RE = /^[A-Za-z][A-Za-z\d+.-]*:/;

function isAbsoluteKernelUrlPrefix(kernelUrlPrefix: string): boolean {
  if (kernelUrlPrefix.startsWith("//")) {
    throw new Error(
      `kernels.*(): invalid origin URL prefix. ` +
        `Expected: scheme-based URLs like \"https://...\" or non-protocol-relative paths. ` +
        `Got: ${kernelUrlPrefix}. ` +
        `Hint: replace leading \"//\" with an explicit scheme.`,
    );
  }

  return ABSOLUTE_URL_RE.test(kernelUrlPrefix);
}

function normalizeOrigin(origin: string): string {
  // Allow empty string (caller may want to provide fully-qualified IDs), but
  // reject whitespace-only values which are almost always mistakes.
  if (origin === "") return "";
  const trimmed = origin.trim();
  if (!trimmed) {
    throw new Error(
      "kernels.*(): invalid origin. Expected: non-empty, non-whitespace string (or \"\" for no prefix). Got: blank/whitespace.",
    );
  }
  return ensureTrailingSlash(trimmed);
}

function normalizePathBase(pathBase: string): string {
  // Allow empty string (no virtual path prefix), but reject whitespace-only.
  if (pathBase === "") return "";
  const trimmed = pathBase.trim();
  if (!trimmed) {
    throw new Error(
      "kernels.*(): invalid pathBase. Expected: non-empty, non-whitespace string (or \"\" for no path prefix). Got: blank/whitespace.",
    );
  }
  return ensureTrailingSlash(trimmed);
}

function normalizeOptionalBaseUrl(baseUrl: string | undefined): string | undefined {
  const trimmed = baseUrl?.trim();
  return trimmed ? trimmed : undefined;
}

function assertDirectoryStyleBaseUrl(baseUrl: string): void {
  const isProtocolRelative = baseUrl.startsWith("//");
  const hasScheme = ABSOLUTE_URL_RE.test(baseUrl);

  if (hasScheme || isProtocolRelative) {
    const base = hasScheme ? new URL(baseUrl) : new URL(baseUrl, "https://tspice.invalid");
    if (!base.pathname.endsWith("/")) {
      throw new Error(
        `kernels.*(): invalid absolute baseUrl. Expected: absolute baseUrl must be directory-style (pathname must end with "/"). Got: ${baseUrl}. Hint: use a directory URL like https://example.com/myapp/.`,
      );
    }
    return;
  }

  if (baseUrl.startsWith("/")) {
    const base = new URL(baseUrl, "https://tspice.invalid");
    if (!base.pathname.endsWith("/")) {
      throw new Error(
        `kernels.*(): invalid path-absolute baseUrl. Expected: path-absolute baseUrl pathname to end with "/". Got: ${baseUrl}. Hint: use /myapp/ instead of /myapp.`,
      );
    }
    return;
  }

  if (!baseUrl.endsWith("/")) {
    throw new Error(
      `kernels.*(): invalid relative baseUrl. Expected: baseUrl to be directory-style (end with "/"). Got: ${baseUrl}. Hint: use myapp/ instead of myapp.`,
    );
  }
}

function normalizePickArgs<T>(
  first: T | readonly T[],
  rest: readonly T[],
): readonly T[] {
  if (first === undefined) {
    throw new Error(
      "kernels.*().pick(): missing kernel selection; expected at least one id/entry. Got: undefined.",
    );
  }

  if (Array.isArray(first)) {
    if (rest.length) {
      throw new Error(
        "kernels.*().pick(): ambiguous argument form. Expected: either pick([entries...]) or pick(first, ...rest). Got: array first argument plus additional arguments. Hint: choose one calling style.",
      );
    }

    if (first.length === 0) {
      throw new Error(
        "kernels.*().pick(): missing kernel selection; expected at least one id/entry. Got: empty array.",
      );
    }
    // Defensive copy to avoid time-of-check/time-of-use surprises if the caller
    // mutates their input array while `pick()` is processing.
    return [...first];
  }

  // TS can't fully narrow `first` to `T` here because `T` itself could be an
  // array type. In practice our `pick` ids/entries are never arrays.
  return [first as T, ...rest];
}

function dedupePreserveOrder<T, K>(items: readonly T[], key: (item: T) => K): T[] {
  const out: T[] = [];
  const seen = new Set<K>();

  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }

  return out;
}

// --- NAIF ---

export type KernelsNaifOptions = {
  /**
   * Kernel URL prefix. This is a *build-time* prefix that is concatenated with
   * each leaf-path kernel id.
   *
   * Examples:
   * - `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/`
   * - `kernels/naif/` (relative; resolved at load time using `baseUrl`)
   *
   * Defaults to NAIF's canonical `generic_kernels` host.
   */
  origin?: string;

  /**
   * Optional directory-style base used at *load time* to resolve relative
   * kernel URLs.
   *
   * This becomes `KernelPack.baseUrl`.
   */
  baseUrl?: string;

  /**
   * Base virtual path used when loading kernels into tspice.
   *
   * Defaults to `""` so leaf ids map directly to paths like
   * `"lsk/naif0012.tls"`.
   */
  pathBase?: string;
};

const DEFAULT_NAIF_ORIGIN = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/";
const DEFAULT_NAIF_PATH_BASE = "";

export type NaifKernelCatalog = {
  pick(id: NaifKernelId): KernelPack;
  pick(ids: readonly [NaifKernelId, ...NaifKernelId[]]): KernelPack;
  pick(first: NaifKernelId, ...rest: readonly NaifKernelId[]): KernelPack;
};

// --- tspice (curated) ---

const DEFAULT_TSPICE_ORIGIN = "https://tspice-viewer.ryboso.me/kernels/naif/";
const DEFAULT_TSPICE_PATH_BASE = "naif/";

export const TSPICE_KERNEL_IDS = [
  // Load order matters (LSK -> PCK -> SPK), but we do **not** reorder; callers
  // can intentionally change ordering if they need to.
  "lsk/naif0012.tls",
  "pck/pck00011.tpc",
  "spk/planets/de432s.bsp",
] as const;

export type TspiceKernelId = (typeof TSPICE_KERNEL_IDS)[number];

export type TspiceKernelCatalog = {
  pick(id: TspiceKernelId): KernelPack;
  pick(ids: readonly [TspiceKernelId, ...TspiceKernelId[]]): KernelPack;
  pick(first: TspiceKernelId, ...rest: readonly TspiceKernelId[]): KernelPack;
};

// --- Custom ---

export type KernelsCustomOptions = {
  /** Kernel URL prefix used for string ids (see `pick(...)`). */
  origin: string;
  /** Optional base URL used when resolving relative kernel URLs. */
  baseUrl?: string;
  /** Virtual path prefix used when mapping string ids to `kernel.path`. */
  pathBase: string;
};

export type CustomKernelEntry = {
  /** Explicit URL (or URL path) for a kernel. */
  url: string;
  /** Explicit virtual path for the kernel (defaults to a stable hashed path). */
  path?: string;
};

export type CustomKernelPick = string | CustomKernelEntry;

export type CustomKernelCatalogUrlOnly = {
  pick(entry: CustomKernelEntry): KernelPack;
  pick(entries: readonly [CustomKernelEntry, ...CustomKernelEntry[]]): KernelPack;
  pick(first: CustomKernelEntry, ...rest: readonly CustomKernelEntry[]): KernelPack;
};

export type CustomKernelCatalog = {
  pick(id: string): KernelPack;
  pick(ids: readonly [string, ...string[]]): KernelPack;
  pick(entries: readonly [CustomKernelPick, ...CustomKernelPick[]]): KernelPack;
  pick(first: CustomKernelPick, ...rest: readonly CustomKernelPick[]): KernelPack;
};

function buildLeafPathKernel(
  id: string,
  opts: { origin: string; pathBase: string },
): KernelPackKernel {
  return {
    url: `${opts.origin}${id}`,
    path: `${opts.pathBase}${id}`,
  };
}

export const kernels = {
  /**
   * Typed NAIF `generic_kernels` catalog.
   *
   * Notes:
   * - IDs are NAIF leaf paths like `"lsk/naif0012.tls"`.
   * - `pick(...)` preserves caller-provided ordering.
   */
  naif: (opts?: KernelsNaifOptions): NaifKernelCatalog => {
    const origin = normalizeOrigin(opts?.origin ?? DEFAULT_NAIF_ORIGIN);
    const pathBase = normalizePathBase(opts?.pathBase ?? DEFAULT_NAIF_PATH_BASE);

    const rawBaseUrl = normalizeOptionalBaseUrl(opts?.baseUrl);
    const baseUrl = isAbsoluteKernelUrlPrefix(origin) ? undefined : rawBaseUrl;
    if (baseUrl !== undefined) {
      assertDirectoryStyleBaseUrl(baseUrl);
    }

    const pickImpl = (first: NaifKernelId | readonly NaifKernelId[], rest: readonly NaifKernelId[]) => {
      const ids = dedupePreserveOrder(normalizePickArgs(first, rest), (id) => id);
      return {
        ...(baseUrl === undefined ? {} : { baseUrl }),
        kernels: ids.map((id) => buildLeafPathKernel(id, { origin, pathBase })),
      };
    };

    return {
      pick: ((first: NaifKernelId | readonly NaifKernelId[], ...rest: readonly NaifKernelId[]) =>
        pickImpl(first, rest)) as NaifKernelCatalog["pick"],
    };
  },

  /**
   * Zero-config, browser-friendly curated kernel catalog.
   *
   * This is intended for quickstarts/demos and is **not recommended for
   * production**. For production, self-host kernels (or proxy) and use
   * `kernels.naif()`/`kernels.naif({ origin?, pathBase?, baseUrl? })` or
   * `kernels.custom(...)`.
   */
  tspice: (): TspiceKernelCatalog => {
    const origin = ensureTrailingSlash(DEFAULT_TSPICE_ORIGIN);
    const pathBase = ensureTrailingSlash(DEFAULT_TSPICE_PATH_BASE);

    const allowed = new Set<string>(TSPICE_KERNEL_IDS);

    const pickImpl = (
      first: TspiceKernelId | readonly TspiceKernelId[],
      rest: readonly TspiceKernelId[],
    ): KernelPack => {
      const ids = dedupePreserveOrder(normalizePickArgs(first, rest), (id) => id);
      for (const id of ids) {
        if (!allowed.has(id)) {
          throw new Error(
            `kernels.tspice().pick(): unsupported curated kernel id. ` +
              `Expected: one of TSPICE_KERNEL_IDS. ` +
              `Got: ${JSON.stringify(id)}. ` +
              `Hint: use kernels.naif().pick(...) for non-curated NAIF IDs.`,
          );
        }
      }

      return {
        kernels: ids.map((id) => buildLeafPathKernel(id, { origin, pathBase })),
      };
    };

    return {
      pick: ((first: TspiceKernelId | readonly TspiceKernelId[], ...rest: readonly TspiceKernelId[]) =>
        pickImpl(first, rest)) as TspiceKernelCatalog["pick"],
    };
  },

  /**
   * Configurable catalog for application/mission-specific kernels.
   *
   * - String ids are mapped as `{ url: origin + id, path: pathBase + id }`.
   * - Explicit `{ url, path? }` entries are passed through; when `path` is
   *   omitted it defaults to a stable hashed path.
   */
  custom: (() => {
    function custom(): CustomKernelCatalogUrlOnly;
    function custom(opts: KernelsCustomOptions): CustomKernelCatalog;
    function custom(opts?: KernelsCustomOptions): CustomKernelCatalog | CustomKernelCatalogUrlOnly {
      const origin = opts === undefined ? undefined : normalizeOrigin(opts.origin);
      const pathBase = opts === undefined ? undefined : normalizePathBase(opts.pathBase);

      const rawBaseUrl = opts === undefined ? undefined : normalizeOptionalBaseUrl(opts.baseUrl);

      const pickImplWithOpts = (
        first: CustomKernelPick | readonly CustomKernelPick[],
        rest: readonly CustomKernelPick[],
      ): KernelPack => {
        const entries = dedupePreserveOrder(
          normalizePickArgs(first, rest),
          (entry) => (typeof entry === "string" ? `id:${entry}` : `url:${entry.url}`),
        );

        const kernelsOut = entries.map((entry): KernelPackKernel => {
          if (typeof entry === "string") {
            // Safety guard: callers can always bypass TS.
            if (origin === undefined || pathBase === undefined) {
              throw new Error(
                "kernels.custom().pick(): string-id mapping is not configured. Expected: string ids require kernels.custom({ origin, pathBase, baseUrl? }). Got: string id with opts omitted. Hint: provide mapping opts or pass explicit { url, path? } entries.",
              );
            }
            return buildLeafPathKernel(entry, { origin, pathBase });
          }

          return {
            url: entry.url,
            path: entry.path ?? defaultKernelPathFromUrl(entry.url),
          };
        });

        // If the pack contains any relative-ish kernel URLs (including root-relative
        // `/...`), include the configured baseUrl so load-time resolution works.
        const baseUrl =
          rawBaseUrl !== undefined && kernelsOut.some((k) => !isAbsoluteKernelUrlPrefix(k.url))
            ? rawBaseUrl
            : undefined;
        if (baseUrl !== undefined) {
          assertDirectoryStyleBaseUrl(baseUrl);
        }

        return {
          ...(baseUrl === undefined ? {} : { baseUrl }),
          kernels: kernelsOut,
        };
      };

      if (opts === undefined) {
        return {
          pick: ((first: CustomKernelEntry | readonly CustomKernelEntry[], ...rest: readonly CustomKernelEntry[]) =>
            pickImplWithOpts(first, rest)) as CustomKernelCatalogUrlOnly["pick"],
        };
      }

      return {
        pick: ((first: CustomKernelPick | readonly CustomKernelPick[], ...rest: readonly CustomKernelPick[]) =>
          pickImplWithOpts(first, rest)) as CustomKernelCatalog["pick"],
      };
    }

    return custom;
  })(),
} as const;
