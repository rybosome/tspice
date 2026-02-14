function fnv1a32Hex(input: string): string {
  // FNV-1a 32-bit
  // https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Derive a stable, collision-resistant-ish virtual kernel path from a kernel URL.
 *
 * - Includes the URL basename for readability.
 * - Includes a stable hash to avoid collisions between distinct URLs.
 */
export function defaultKernelPathFromUrl(url: string): string {
  // We don't include fragment in the hash since it isn't sent to the server.
  const withoutFragment = url.replace(/#.*/, "");

  // Strip query/hash for basename extraction so paths stay readable.
  const withoutQueryHash = url.replace(/[?#].*$/, "");
  const base = withoutQueryHash.split("/").filter(Boolean).pop() ?? "";

  // Fall back to a stable sentinel instead of generating `/kernels/<hash>-`.
  const safeBase = (base || "kernel").replace(/[\\/]/g, "_");

  const hash = fnv1a32Hex(withoutFragment);
  return `/kernels/${hash}-${safeBase}`;
}
