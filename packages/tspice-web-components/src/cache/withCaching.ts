import type { SpiceTransport } from "../types.js";

export type CachePolicy = "cache" | "no-store";

const DEFAULT_UNSAFE_NO_STORE_PREFIXES = [
  // Kernel-loading / kernel pool mutation operations. These can contain large
  // binary payloads, and caching them can break correctness by skipping
  // side-effects.
  "kit.loadKernel",
  "kit.unloadKernel",
  "kit.kclear",
  "raw.furnsh",
  "raw.unload",
  "raw.kclear",
] as const;

const matchesAnyPrefix = (op: string, prefixes: readonly string[] | undefined): boolean => {
  if (!prefixes || prefixes.length === 0) return false;
  for (const prefix of prefixes) {
    if (prefix && op.startsWith(prefix)) return true;
  }
  return false;
};

export type CachingTransport = SpiceTransport & {
  /**
   * Clear all cached entries.
   *
   * Note: this does not cancel in-flight requests; it just drops references so
   * results won't be reused.
   */
  clear(): void;
  /** Stop any sweep timers and clear all cached entries. */
  dispose(): void;
};

export type WithCachingOptions = {
  /**
   * Maximum number of entries to retain (LRU-evicted on overflow).
   *
   * - `undefined` => defaults to `1000`
   * - `Infinity` => unbounded
   * - `<= 0` => caching disabled
   */
  maxEntries?: number;
  /**
   * Time-to-live in milliseconds, measured from the time the value resolves.
   *
   * - `undefined`/`null` => no TTL (cache forever, LRU-bounded)
   * - `<= 0` => caching disabled
   * - `> 0` => absolute TTL (non-sliding)
   */
  ttlMs?: number | null;
  /**
   * Optional periodic TTL sweep. Without this, TTL eviction is lazy (only on
   * subsequent `request()` calls).
   */
  sweepIntervalMs?: number;
  /**
   * Cache key function. Returning `null` disables caching for that call.
   */
  key?: (op: string, args: unknown[]) => string | null;

  /**
   * Optional per-op cache policy.
   *
   * - `"cache"` => normal caching behavior
   * - `"no-store"` => bypass cache entirely (no key computation, no read/write)
   *
   * By default, kernel-mutating ops (e.g. `kit.loadKernel`, `raw.furnsh`) are
   * treated as `"no-store"`.
   */
  policy?: Record<string, CachePolicy>;

  /**
   * Optional list of op-name prefixes that should default to `"no-store"`.
   *
   * This is useful for future-proofing (e.g. if new kernel mutation ops are
   * introduced upstream).
   */
  noStorePrefixes?: string[];

  /**
   * If `true`, allows `policy` to override built-in unsafe default `"no-store"`
   * ops to `"cache"`.
   *
   * Without this, attempts to force-cache these ops will be treated as
   * `"no-store"` as a guardrail.
   */
  allowUnsafePolicyOverrides?: boolean;
};

export type WithCachingResult = SpiceTransport | CachingTransport;

/**
 * Type guard for narrowing a transport returned by `withCaching()`.
 */
export function isCachingTransport(t: unknown): t is CachingTransport {
  if (typeof t !== "object" || t === null) return false;

  const v = t as Record<string, unknown>;
  return typeof v.clear === "function" && typeof v.dispose === "function";
}

type CacheEntry = {
  promise: Promise<unknown>;
  /** Epoch ms (exclusive). `undefined` => no TTL */
  expiresAt?: number;
};

type Unrefable = {
  unref?: unknown;
};

function defaultKey(op: string, args: unknown[]): string | null {
  try {
    return JSON.stringify([op, args]);
  } catch {
    // Safer failure mode: if we can't build a stable key, don't cache.
    return null;
  }
}

export function withCaching(
  base: SpiceTransport,
  opts?: WithCachingOptions,
): WithCachingResult {
  const rawMaxEntries = opts?.maxEntries;
  const maxEntries = rawMaxEntries ?? 1000;
  const maxEntriesLimit =
    maxEntries === Infinity ? undefined : Number.isFinite(maxEntries) ? maxEntries : 0;

  const rawTtlMs = opts?.ttlMs;
  const ttlMs = rawTtlMs == null ? undefined : rawTtlMs;

  const cachingEnabled =
    (ttlMs === undefined || ttlMs > 0) &&
    (maxEntriesLimit === undefined || maxEntriesLimit > 0);

  // True no-op mode: preserve the input object identity and avoid allocating
  // any wrapper state when caching is disabled.
  if (!cachingEnabled) return base;

  const keyFn = opts?.key ?? defaultKey;
  const policyByOp = opts?.policy;
  // Normalize once up-front so callers can't accidentally pass whitespace or
  // an empty string that behaves like a wildcard (`op.startsWith("") === true`).
  const noStorePrefixes = opts?.noStorePrefixes
    ?.map((p) => p.trim())
    .filter((p) => p.length > 0);
  const allowUnsafePolicyOverrides = opts?.allowUnsafePolicyOverrides === true;

  const getPolicy = (op: string): CachePolicy => {
    const explicit = policyByOp?.[op];
    const isUnsafeDefault = matchesAnyPrefix(op, DEFAULT_UNSAFE_NO_STORE_PREFIXES);

    if (explicit === "cache") {
      if (isUnsafeDefault && !allowUnsafePolicyOverrides) return "no-store";
      return "cache";
    }

    if (explicit === "no-store") return "no-store";

    if (isUnsafeDefault) return "no-store";
    if (matchesAnyPrefix(op, noStorePrefixes)) return "no-store";
    return "cache";
  };

  const cache = new Map<string, CacheEntry>();
  let sweepTimer: ReturnType<typeof setInterval> | undefined;

  const isExpired = (entry: CacheEntry, now: number): boolean =>
    entry.expiresAt !== undefined && entry.expiresAt <= now;

  const cleanupExpired = (now: number): void => {
    // TTL eviction is optional. When ttlMs is undefined, the cache is “forever”
    // (still LRU-bounded by maxEntries).
    if (ttlMs === undefined || ttlMs <= 0) return;

    for (const [k, entry] of cache) {
      if (isExpired(entry, now)) cache.delete(k);
    }
  };

  if (cachingEnabled && ttlMs !== undefined && ttlMs > 0) {
    const sweepIntervalMs = opts?.sweepIntervalMs;
    if (sweepIntervalMs !== undefined && sweepIntervalMs > 0) {
      sweepTimer = setInterval(() => cleanupExpired(Date.now()), sweepIntervalMs);

      // In Node, interval timers keep the event loop alive by default. `unref()`
      // prevents this from pinning test runners / CLIs. Browsers return a
      // numeric id (no-op).
      const unref = (sweepTimer as unknown as Unrefable).unref;
      if (typeof unref === "function") unref.call(sweepTimer);
    }
  }

  const clear = (): void => {
    cache.clear();
  };

  const dispose = (): void => {
    if (sweepTimer !== undefined) {
      clearInterval(sweepTimer);
      sweepTimer = undefined;
    }

    cache.clear();
  };

  const touch = (k: string, entry: CacheEntry): void => {
    cache.delete(k);
    cache.set(k, entry);
  };

  const enforceMaxEntries = (): void => {
    if (maxEntriesLimit === undefined) return;

    while (cache.size > maxEntriesLimit) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (oldestKey === undefined) return;
      cache.delete(oldestKey);
    }
  };

  const request = (op: string, args: unknown[]): Promise<unknown> => {
    // Per-method cache policy. When bypassing, skip *all* cache work (no key
    // computation, no reads/writes, no TTL sweeps).
    if (getPolicy(op) === "no-store") return base.request(op, args);

    const k = keyFn(op, args);
    if (k == null) return base.request(op, args);

    const now = Date.now();
    cleanupExpired(now);

    const existing = cache.get(k);
    if (existing && !isExpired(existing, now)) {
      // LRU touch on access. TTL remains absolute (does not refresh on access).
      touch(k, existing);
      return existing.promise;
    }

    if (existing) cache.delete(k);

    // Cache the in-flight promise to dedupe concurrent callers.
    let promise!: Promise<unknown>;
    promise = base.request(op, args).then(
      (value) => {
        if (ttlMs !== undefined && ttlMs > 0) {
          const current = cache.get(k);
          if (current?.promise === promise) {
            current.expiresAt = Date.now() + ttlMs;
          }
        }
        return value;
      },
      (err) => {
        // Never cache rejections.
        const current = cache.get(k);
        if (current?.promise === promise) cache.delete(k);
        throw err;
      },
    );

    cache.set(k, { promise });
    enforceMaxEntries();

    return promise;
  };

  return {
    request,
    clear,
    dispose,
  };
}
