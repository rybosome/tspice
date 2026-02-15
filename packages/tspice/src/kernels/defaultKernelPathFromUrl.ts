const FNV_64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_64_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

const DEFAULT_URL_HASH_HEX_PREFIX_LEN = 12;

function fnv1a64Hex(input: string): string {
  // FNV-1a 64-bit
  // https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
  let hash = FNV_64_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * FNV_64_PRIME) & UINT64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
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

  const hash = fnv1a64Hex(withoutFragment).slice(0, DEFAULT_URL_HASH_HEX_PREFIX_LEN);
  return `/kernels/${hash}-${safeBase}`;
}
