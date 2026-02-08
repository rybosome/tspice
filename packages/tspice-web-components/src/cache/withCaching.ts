import type { SpiceTransport } from "../types.js";

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

type CacheEntry = {
  promise: Promise<unknown>;
  /** Epoch ms (exclusive). `undefined` => no TTL */
  expiresAt?: number;
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
  opts?: {
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
  },
): CachingTransport {
  const keyFn = opts?.key ?? defaultKey;

  const rawMaxEntries = opts?.maxEntries;
  const maxEntries = rawMaxEntries ?? 1000;
  const maxEntriesLimit =
    maxEntries === Infinity ? undefined : Number.isFinite(maxEntries) ? maxEntries : 0;

  const rawTtlMs = opts?.ttlMs;
  const ttlMs = rawTtlMs == null ? undefined : rawTtlMs;

  const cachingEnabled =
    (ttlMs === undefined || ttlMs > 0) &&
    (maxEntriesLimit === undefined || maxEntriesLimit > 0);

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
      (sweepTimer as any)?.unref?.();
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
    // Explicit “no cache” mode.
    if (!cachingEnabled) return base.request(op, args);

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

    // Insert immediately to dedupe in-flight requests.
    const entry: CacheEntry = {
      promise: Promise.resolve(undefined),
    };

    cache.set(k, entry);
    enforceMaxEntries();

    entry.promise = base.request(op, args).then(
      (value) => {
        if (ttlMs !== undefined && ttlMs > 0 && cache.get(k) === entry) {
          entry.expiresAt = Date.now() + ttlMs;
        }
        return value;
      },
      (err) => {
        // Never cache rejections.
        if (cache.get(k) === entry) cache.delete(k);
        throw err;
      },
    );

    return entry.promise;
  };

  return {
    request,
    clear,
    dispose,
  };
}
