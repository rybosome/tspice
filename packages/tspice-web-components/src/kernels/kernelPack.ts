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
   * Base URL/path to resolve each `kernel.url` against when it is relative.
   *
   * This is intentionally passed in (rather than relying on `import.meta.env.BASE_URL`)
   * so this helper can be used outside Vite and can be tested deterministically.
   */
  baseUrl?: string;

  /** Override `fetch` implementation (useful for tests and non-browser runtimes). */
  fetch?: FetchLike;
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

function isAbsoluteBaseUrl(baseUrl: string): boolean {
  // NOTE: protocol-relative base URLs (`//...`) are not parseable by the URL
  // constructor without a scheme, so we only treat scheme-based bases as
  // "absolute" here.
  return hasUrlScheme(baseUrl);
}

function resolveKernelUrl(url: string, baseUrl: string | undefined): string {
  if (!baseUrl) return url;

  // If the kernel URL is already absolute, don't apply `baseUrl`.
  if (isAbsoluteUrl(url)) return url;

  // If `baseUrl` is absolute, lean on the URL constructor for proper resolution
  // semantics (including `url` values like `/kernels/a`).
  if (isAbsoluteBaseUrl(baseUrl)) {
    const base = new URL(baseUrl);
    // Treat `baseUrl` as a directory prefix even when it doesn't end with `/`.
    if (!base.pathname.endsWith("/")) base.pathname = `${base.pathname}/`;
    return new URL(url, base).toString();
  }

  // Support protocol-relative CDN-style bases (e.g. `//cdn.example.com/assets/`).
  if (baseUrl.startsWith("//")) {
    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const rel = url.startsWith("/") ? url.slice(1) : url;
    return `${base}${rel}`;
  }

  // `baseUrl` is path-absolute (commonly a Vite BASE_URL like `/myapp/`).
  // Use the URL constructor with a dummy origin so dot-segments normalize.
  if (baseUrl.startsWith("/")) {
    // If `url` is already an absolute *path*, leave it alone.
    if (url.startsWith("/")) return url;

    const base = new URL(baseUrl, "https://tspice.invalid");
    // Treat `baseUrl` as a directory prefix even when it doesn't end with `/`.
    if (!base.pathname.endsWith("/")) base.pathname = `${base.pathname}/`;

    const resolved = new URL(url, base);
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  }

  // `baseUrl` is relative.
  // If `url` is already an absolute *path*, leave it alone.
  if (url.startsWith("/")) return url;

  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}${url}`;
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
 * Fetching is done in parallel, but kernels are *loaded* sequentially in pack order.
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
}
