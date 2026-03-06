import type { KernelSource } from "@rybosome/tspice-backend-contract";

export type KernelPackKernel = {
  /** URL (or URL path) to fetch kernel bytes from. */
  url: string;
  /** Virtual path/identifier used when loading the kernel into tspice. */
  path: string;
};

export type KernelPack = {
  /**
   * Base URL/path *directory* to resolve each `kernel.url` against when it is relative.
   *
   * Notes:
   * - Absolute `kernel.url` values (e.g. `https://...`, `data:...`, `blob:...`) are left as-is.
   * - Root-relative `kernel.url` values (starting with `/`) default to bypassing `baseUrl`.
   *   Use `rootRelativeKernelUrlBehavior` to change this.
   *
   * Base URL semantics:
   * - `baseUrl` must be **directory-style**: its URL `pathname` ends with `/`.
   *   (For plain path strings, this effectively means the string ends with `/`.)
   *   This holds regardless of whether it is:
   *   - scheme-based (`https://...`)
   *   - path-absolute (`/myapp/`)
   *   - path-relative (`myapp/`)
   * - `baseUrl` is trimmed before use; trimmed-empty (`""` or whitespace) is treated the same as
   *   `undefined` (no prefixing / leave relative URLs as-is).
   *
   * This avoids the surprising file-vs-directory behavior of `new URL(url, baseUrl)`.
   * For example:
   * - `baseUrl: "/myapp/"` + `url: "kernels/a.tls"` → `"/myapp/kernels/a.tls"`
   * - `baseUrl: "/myapp"` would be ambiguous (file vs directory) and therefore throws.
   * - If you have a page path like `"/app/index.html"`, pass its directory (`"/app/"`).
   *
   * This is intentionally stored on the pack (rather than passed at load time)
   * so the URL-rooting decision lives next to the catalog that produced the pack.
   */
  baseUrl?: string;
  kernels: readonly KernelPackKernel[];
};

export type ResponseLike = {
  ok: boolean;
  status: number;
  statusText: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

// Structural fetch typing so we don't leak DOM lib types into emitted .d.ts.
export type FetchLike = (input: string, init?: unknown) => Promise<ResponseLike>;

export type RootRelativeKernelUrlBehavior =
  | "bypassBaseUrl"
  | "applyBaseOrigin"
  | "error";

export type LoadKernelPackOptions = {
  /**
   * Controls how root-relative kernel URLs (`"/..."`) interact with `pack.baseUrl`.
   *
   * - `"bypassBaseUrl"` (default): root-relative URLs are left as-is.
   * - `"applyBaseOrigin"`: when `baseUrl` is scheme-based,
   *   root-relative URLs are resolved against `baseUrl`'s origin.
   * - `"error"`: throw if `baseUrl` is provided and a kernel URL is root-relative.
   */
  rootRelativeKernelUrlBehavior?: RootRelativeKernelUrlBehavior;

  /** Override `fetch` implementation (useful for tests and non-browser runtimes). */
  fetch?: FetchLike;

  /**
   * Controls how kernel bytes are fetched.
   *
   * - `"sequential"` (default): fetch + load one kernel at a time (lower peak memory).
   * - `"parallel"`: fetch all kernels in parallel, then load sequentially in pack order
   *   (faster, higher peak memory).
   */
  fetchStrategy?: "parallel" | "sequential";
};

export type SpiceWithLoadKernel = {
  kit: {
    loadKernel: (kernel: KernelSource) => void | Promise<void>;
  };
};

const ABSOLUTE_URL_RE = /^[A-Za-z][A-Za-z\d+.-]*:/;

function hasUrlScheme(url: string): boolean {
  return ABSOLUTE_URL_RE.test(url);
}

function isAbsoluteUrl(url: string): boolean {
  // `https://...`, `data:...`, `blob:...`, etc.
  if (hasUrlScheme(url)) return true;

  return false;
}

function throwProtocolRelativeUrlError(opts: { label: string; url: string }): never {
  throw new Error(
    `${opts.label}: invalid URL form. ` +
      `Expected: scheme-based URLs like \"https://...\" or non-protocol-relative paths. ` +
      `Got: ${opts.url}. ` +
      `Hint: replace leading \"//\" with an explicit scheme.`,
  );
}


/**
 * Resolve a kernel URL against an optional `baseUrl`, respecting the configured
 * behavior for root-relative URLs.
 */
export function resolveKernelUrl(
  url: string,
  baseUrl: string | undefined,
  rootRelativeKernelUrlBehavior: RootRelativeKernelUrlBehavior,
): string {
  if (url.startsWith("//")) {
    throwProtocolRelativeUrlError({ label: "loadKernelPack(): kernel.url", url });
  }

  const normalizedBaseUrl = baseUrl?.trim();
  // Treat trimmed-empty the same as `undefined` to avoid surprising behavior when
  // `baseUrl` is sourced from config/env where "" / whitespace are common defaults.
  if (!normalizedBaseUrl) return url;

  if (normalizedBaseUrl.startsWith("//")) {
    throwProtocolRelativeUrlError({ label: "loadKernelPack(): pack.baseUrl", url: normalizedBaseUrl });
  }

  // If the kernel URL is already absolute, don't apply `baseUrl`.
  if (isAbsoluteUrl(url)) return url;

  // Root-relative kernel URLs need special handling since they're already
  // absolute within an origin.
  if (url.startsWith("/")) {
    if (rootRelativeKernelUrlBehavior === "bypassBaseUrl") return url;

    if (rootRelativeKernelUrlBehavior === "error") {
      throw new Error(
        `loadKernelPack(): incompatible root-relative kernel URL with current behavior. ` +
          `Expected: relative kernel.url when rootRelativeKernelUrlBehavior=\"error\". ` +
          `Got: kernel.url=${url}, baseUrl=${normalizedBaseUrl}. ` +
          `Hint: use a relative kernel URL or set rootRelativeKernelUrlBehavior to \"bypassBaseUrl\" or \"applyBaseOrigin\".`,
      );
    }

    // applyBaseOrigin: root-relative URLs should inherit only the origin from
    // an absolute-ish baseUrl.
    if (hasUrlScheme(normalizedBaseUrl)) {
      const base = new URL(normalizedBaseUrl);
      return new URL(url, base).toString();
    }

    // For path-absolute (`/myapp/`) and relative (`myapp/`) base URLs, applying
    // "origin" is a no-op (the URL already targets the caller's origin).
    return url;
  }

  // If `baseUrl` is scheme-based, lean on
  // the URL constructor for proper resolution semantics and normalization.
  if (hasUrlScheme(normalizedBaseUrl)) {
    const base = new URL(normalizedBaseUrl);
    // Enforce directory-style absolute base URLs to avoid the surprising
    // file-vs-directory behavior of `new URL(url, baseUrl)`.
    if (!base.pathname.endsWith("/")) {
      throw new Error(
        `loadKernelPack(): invalid absolute baseUrl. Expected: absolute baseUrl must be directory-style (pathname must end with \"/\"). Got: ${normalizedBaseUrl}. Hint: append a trailing slash to indicate directory semantics.`,
      );
    }

    const resolved = new URL(url, base);
    return resolved.toString();
  }

  // `baseUrl` is path-absolute (commonly a Vite BASE_URL like `/myapp/`).
  // Use the URL constructor with a dummy origin so dot-segments normalize.
  if (normalizedBaseUrl.startsWith("/")) {
    const base = new URL(normalizedBaseUrl, "https://tspice.invalid");
    if (!base.pathname.endsWith("/")) {
      throw new Error(
        `loadKernelPack(): invalid path-absolute baseUrl. Expected: path-absolute baseUrl pathname to end with \"/\". Got: ${normalizedBaseUrl}. Hint: use /myapp/ instead of /myapp.`,
      );
    }

    const resolved = new URL(url, base);
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  }

  // `baseUrl` is relative.
  // Treat the base as a directory prefix.
  if (!normalizedBaseUrl.endsWith("/")) {
    throw new Error(
      `loadKernelPack(): invalid relative baseUrl. Expected: baseUrl to be directory-style (end with \"/\"). Got: ${normalizedBaseUrl}. Hint: use myapp/ instead of myapp.`,
    );
  }

  return `${normalizedBaseUrl}${url}`;
}

async function fetchKernelBytes(fetchFn: FetchLike, url: string): Promise<Uint8Array> {
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(
      `loadKernelPack(): failed to fetch kernel bytes. Expected: HTTP success response for ${url}. Got: status=${res.status} ${res.statusText}. Hint: verify URL, network access, and auth/CORS settings.`,
    );
  }

  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Load the given kernel pack into the provided `tspice` instance.
 *
 * By default, kernels are fetched and loaded sequentially to avoid holding all
 * kernel bytes in memory at once.
 *
 * Set `opts.fetchStrategy: "parallel"` to fetch all kernels in parallel (kernels
 * are still loaded sequentially in pack order).
 */
export async function loadKernelPack(
  spice: SpiceWithLoadKernel,
  pack: KernelPack,
  opts?: LoadKernelPackOptions,
): Promise<void> {
  // Migration guard: `baseUrl` moved from load options to `pack.baseUrl`.
  if (opts && Object.prototype.hasOwnProperty.call(opts as unknown as object, "baseUrl")) {
    throw new Error(
      "loadKernelPack(): deprecated option used. Expected: opts.baseUrl has been removed; set pack.baseUrl instead (and pass the pack to spiceClients.withKernels(pack)). Got: opts.baseUrl provided.",
    );
  }

  const fetchFn =
    opts?.fetch ?? ((globalThis as unknown as { fetch?: FetchLike }).fetch ?? undefined);

  if (!fetchFn) {
    throw new Error(
      "loadKernelPack(): fetch implementation missing. Expected: opts.fetch, spiceClients.withFetch(fetch), or globalThis.fetch. Got: undefined. Hint: inject a fetch function in non-browser or sandboxed runtimes.",
    );
  }

  const fetchStrategy = opts?.fetchStrategy ?? "sequential";
  const rootRelativeKernelUrlBehavior = opts?.rootRelativeKernelUrlBehavior ?? "bypassBaseUrl";

  if (fetchStrategy === "parallel") {
    const bytes = await Promise.all(
      pack.kernels.map((k) =>
        fetchKernelBytes(
          fetchFn,
          resolveKernelUrl(k.url, pack.baseUrl, rootRelativeKernelUrlBehavior),
        ),
      ),
    );

    for (const [i, kernel] of pack.kernels.entries()) {
      const kernelBytes = bytes[i]!;
      await spice.kit.loadKernel({ path: kernel.path, bytes: kernelBytes });
    }

    return;
  }

  for (const kernel of pack.kernels) {
    const kernelBytes = await fetchKernelBytes(
      fetchFn,
      resolveKernelUrl(kernel.url, pack.baseUrl, rootRelativeKernelUrlBehavior),
    );
    await spice.kit.loadKernel({ path: kernel.path, bytes: kernelBytes });
  }
}
