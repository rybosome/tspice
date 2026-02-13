import type { SpiceTransportSync } from "../types.js";

import { createCachePolicy } from "./policy.js";

import {
  defaultSpiceCacheKey,
  type WithCachingOptions,
} from "./withCaching.js";

const cachingTransportBrand = new WeakSet<object>();

const defaultOnWarning = (message: string): void => {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(message);
  }
};

export type CachingTransportSync = SpiceTransportSync & {
  /**
   * Clear all cached entries.
   *
   * Notes:
   * - This does not cancel in-flight requests; it just drops references so
   *   results won't be reused.
   * - This does not stop the optional TTL sweep timer. Use `dispose()` to stop
   *   timers and clear cache.
   */
  clear(): void;
  /** Stop any sweep timers and clear all cached entries. */
  dispose(): void;
};

export type WithCachingSyncResult = SpiceTransportSync | CachingTransportSync;

/**
 * Type guard for narrowing a transport returned by `withCachingSync()`.
 */
export function isCachingTransportSync(t: unknown): t is CachingTransportSync {
  if (typeof t !== "object" || t === null) return false;

  if (!cachingTransportBrand.has(t)) return false;

  const v = t as Record<string, unknown>;
  return (
    typeof v.request === "function" &&
    typeof v.clear === "function" &&
    typeof v.dispose === "function"
  );
}

type CacheEntry = {
  value: unknown;
  /** Epoch ms (exclusive). `undefined` => no TTL */
  expiresAt?: number;
};

type Unrefable = {
  unref?: unknown;
};

function tryUnrefTimer(timer: unknown): void {
  let unref: unknown;
  try {
    unref = (timer as Unrefable).unref;
  } catch {
    return;
  }

  if (typeof unref !== "function") return;

  try {
    unref.call(timer);
  } catch {
    // Ignore. Some runtimes / shims may throw for `unref` even when present.
  }
}

export function withCachingSync(
  base: SpiceTransportSync,
  opts?: WithCachingOptions,
): WithCachingSyncResult {
  // Note: cached values are returned by reference. If a caller mutates the
  // returned object/array, subsequent cache hits will observe that mutation.
  // Treat results as immutable (or clone them yourself) when caching is enabled.
  const rawMaxEntries = opts?.maxEntries;
  const maxEntries = rawMaxEntries ?? 1000;
  const maxEntriesLimit =
    maxEntries === Infinity
      ? undefined
      : Number.isFinite(maxEntries)
        ? maxEntries
        : 0;

  const rawTtlMs = opts?.ttlMs;
  const ttlMs = rawTtlMs == null ? undefined : rawTtlMs;

  const cachingEnabled =
    (ttlMs === undefined || ttlMs > 0) &&
    (maxEntriesLimit === undefined || maxEntriesLimit > 0);

  // True no-op mode: preserve the input object identity and avoid allocating
  // any wrapper state when caching is disabled.
  if (!cachingEnabled) return base;

  // Only pick defaults after the no-op early return so disabled caching pays
  // ~0 overhead.
  const now = opts?.now ?? Date.now;
  const onWarning = opts?.onWarning ?? defaultOnWarning;

  const keyFn = opts?.key ?? defaultSpiceCacheKey;
  const policyByOp = opts?.policy;
  const allowUnsafePolicyOverrides = opts?.allowUnsafePolicyOverrides === true;
  const allowBroadNoStorePrefixes = opts?.allowBroadNoStorePrefixes === true;

  const getPolicy = createCachePolicy({
    wrapperName: "withCachingSync()",
    onWarning,
    policyByOp,
    noStorePrefixes: opts?.noStorePrefixes,
    allowBroadNoStorePrefixes,
    allowUnsafePolicyOverrides,
  });

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
      sweepTimer = setInterval(() => cleanupExpired(now()), sweepIntervalMs);

      // In Node, interval timers keep the event loop alive by default. `unref()`
      // prevents this from pinning test runners / CLIs. Browsers return a
      // numeric id (no-op).
      tryUnrefTimer(sweepTimer);
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

  const request = (op: string, args: unknown[]): unknown => {
    // Per-method cache policy. When bypassing, skip *all* cache work (no key
    // computation, no reads/writes, no TTL sweeps).
    if (getPolicy(op) === "no-store") return base.request(op, args);

    const k = keyFn(op, args);
    if (k == null) return base.request(op, args);

    const nowMs = now();
    cleanupExpired(nowMs);

    const existing = cache.get(k);
    if (existing && !isExpired(existing, nowMs)) {
      // LRU touch on access. TTL remains absolute (does not refresh on access).
      touch(k, existing);
      return existing.value;
    }

    if (existing) cache.delete(k);

    // Only cache successful responses.
    let value: unknown;
    try {
      value = base.request(op, args);
    } catch (err) {
      cache.delete(k);
      throw err;
    }

    const entry: CacheEntry = { value };
    if (ttlMs !== undefined && ttlMs > 0) {
      entry.expiresAt = now() + ttlMs;
    }

    cache.set(k, entry);
    enforceMaxEntries();

    return value;
  };

  const transport = { request, clear, dispose };
  cachingTransportBrand.add(transport);
  return transport;
}
