import type { KernelSource } from "@rybosome/tspice";

export type KernelPackKernel = {
  /** URL (or URL path) to fetch kernel bytes from. */
  url: string;
  /** Virtual path/identifier used when loading the kernel into tspice. */
  path: string;
};

export type KernelPack = {
  kernels: readonly KernelPackKernel[];
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type LoadKernelPackOptions = {
  /**
   * Base URL/path *directory* to resolve each `kernel.url` against when it is relative.
   *
   * Notes:
   * - Absolute `kernel.url` values (e.g. `https://...`, `data:...`, `blob:...`) are left as-is.
   * - Root-relative `kernel.url` values (starting with `/`) are left as-is.
   *
   * Base URL semantics:
   * - `baseUrl` must be **directory-style** (end with `/`), regardless of whether it is:
   *   - scheme-based (`https://...`)
   *   - protocol-relative (`//...`)
   *   - path-absolute (`/myapp/`)
   *   - path-relative (`myapp/`)
   *
   * This avoids the surprising file-vs-directory behavior of `new URL(url, baseUrl)`.
   * For example:
   * - `baseUrl: "/myapp/"` + `url: "kernels/a.tls"` → `"/myapp/kernels/a.tls"`
   * - `baseUrl: "/myapp"` would be ambiguous (file vs directory) and therefore throws.
   * - If you have a page path like `"/app/index.html"`, pass its directory (`"/app/"`).
   *
   * This is intentionally passed in (rather than relying on `import.meta.env.BASE_URL`)
   * so this helper can be used outside Vite and can be tested deterministically.
   */
  baseUrl?: string;

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

  // Protocol-relative (`//cdn.example.com/...`).
  if (url.startsWith("//")) return true;

  return false;
}


function resolveKernelUrl(url: string, baseUrl: string | undefined): string {
  if (!baseUrl) return url;

  // If the kernel URL is already absolute, don't apply `baseUrl`.
  if (isAbsoluteUrl(url)) return url;

  // Root-relative kernel URLs bypass `baseUrl`.
  if (url.startsWith("/")) return url;

  const isProtocolRelativeBaseUrl = baseUrl.startsWith("//");

  // If `baseUrl` is absolute-ish (scheme-based or protocol-relative), lean on
  // the URL constructor for proper resolution semantics and normalization.
  if (hasUrlScheme(baseUrl) || isProtocolRelativeBaseUrl) {
    const base = hasUrlScheme(baseUrl)
      ? new URL(baseUrl)
      : new URL(baseUrl, "https://tspice.invalid");
    // Enforce directory-style absolute base URLs to avoid the surprising
    // file-vs-directory behavior of `new URL(url, baseUrl)`.
    if (!base.pathname.endsWith("/")) {
      throw new Error(
        `loadKernelPack(): absolute baseUrl must be directory-style (end with \"/\"): ${baseUrl}`,
      );
    }

    const resolved = new URL(url, base);
    if (isProtocolRelativeBaseUrl) {
      return `//${resolved.host}${resolved.pathname}${resolved.search}${resolved.hash}`;
    }

    return resolved.toString();
  }

  // `baseUrl` is path-absolute (commonly a Vite BASE_URL like `/myapp/`).
  // Use the URL constructor with a dummy origin so dot-segments normalize.
  if (baseUrl.startsWith("/")) {
    const base = new URL(baseUrl, "https://tspice.invalid");
    if (!base.pathname.endsWith("/")) {
      throw new Error(
        `loadKernelPack(): path-absolute baseUrl must be directory-style (end with \"/\"): ${baseUrl}`,
      );
    }

    const resolved = new URL(url, base);
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  }

  // `baseUrl` is relative.
  // If `url` is already an absolute *path*, leave it alone.
  if (url.startsWith("/")) return url;

  if (!baseUrl.endsWith("/")) {
    throw new Error(
      `loadKernelPack(): relative baseUrl must be directory-style (end with \"/\"): ${baseUrl}`,
    );
  }
  return `${baseUrl}${url}`;
}

async function fetchKernelBytes(fetchFn: FetchLike, url: string): Promise<Uint8Array> {
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch kernel: ${url} (status=${res.status} ${res.statusText})`);
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
  const fetchFn =
    opts?.fetch ?? ((globalThis as unknown as { fetch?: FetchLike }).fetch ?? undefined);

  if (!fetchFn) {
    throw new Error("loadKernelPack(): `fetch` is not available; pass opts.fetch");
  }

  const fetchStrategy = opts?.fetchStrategy ?? "sequential";

  if (fetchStrategy === "parallel") {
    const bytes = await Promise.all(
      pack.kernels.map((k) => fetchKernelBytes(fetchFn, resolveKernelUrl(k.url, opts?.baseUrl))),
    );

    for (const [i, kernel] of pack.kernels.entries()) {
      const kernelBytes = bytes[i];
      if (!kernelBytes) {
        throw new Error("loadKernelPack(): internal error (bytes array length mismatch)");
      }

      await spice.kit.loadKernel({ path: kernel.path, bytes: kernelBytes });
    }

    return;
  }

  for (const kernel of pack.kernels) {
    const kernelBytes = await fetchKernelBytes(
      fetchFn,
      resolveKernelUrl(kernel.url, opts?.baseUrl),
    );
    await spice.kit.loadKernel({ path: kernel.path, bytes: kernelBytes });
  }
}
