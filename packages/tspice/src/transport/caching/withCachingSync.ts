import type { SpiceTransportSync } from "../types.js";

import {
  type CachePolicy,
  defaultSpiceCacheKey,
  type WithCachingOptions,
} from "./withCaching.js";

const DEFAULT_UNSAFE_NO_STORE_OPS = Object.freeze([
  // Kernel-loading / kernel pool mutation operations. These can contain large
  // binary payloads, and caching them can break correctness by skipping
  // side-effects.
  "kit.loadKernel",
  "kit.unloadKernel",
  "kit.kclear",
  "raw.furnsh",
  "raw.unload",
  "raw.kclear",
]) satisfies readonly string[];

const DEFAULT_UNSAFE_NO_STORE_OPS_LOOKUP: Readonly<Record<string, true>> = Object.freeze(
  DEFAULT_UNSAFE_NO_STORE_OPS.reduce<Record<string, true>>((acc, op) => {
    acc[op] = true;
    return acc;
  }, {}),
);

const matchesAnyPrefix = (op: string, prefixes: readonly string[] | undefined): boolean => {
  if (!prefixes || prefixes.length === 0) return false;
  for (const prefix of prefixes) {
    if (prefix && op.startsWith(prefix)) return true;
  }
  return false;
};

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

  // Only pick defaults after the no-op early return so disabled caching pays
  // ~0 overhead.
  const now = opts?.now ?? Date.now;
  const onWarning = opts?.onWarning ?? defaultOnWarning;

  // Warning de-dupe (per wrapper instance).
  const warnedBroadNoStorePrefixSets = new Set<string>();
  const shouldWarnBroadNoStorePrefixes = (warnKey: string): boolean => {
    if (warnedBroadNoStorePrefixSets.has(warnKey)) return false;
    warnedBroadNoStorePrefixSets.add(warnKey);
    return true;
  };

  const keyFn = opts?.key ?? defaultSpiceCacheKey;
  const policyByOp = opts?.policy;
  // Normalize once up-front so callers can't accidentally pass whitespace or
  // an empty string that behaves like a wildcard (`op.startsWith("") === true`).
  const noStorePrefixes = opts?.noStorePrefixes
    ?.map((p) => p.trim())
    .filter((p) => p.length > 0);
  const allowUnsafePolicyOverrides = opts?.allowUnsafePolicyOverrides === true;
  const allowBroadNoStorePrefixes = opts?.allowBroadNoStorePrefixes === true;

  if (!allowBroadNoStorePrefixes && noStorePrefixes && noStorePrefixes.length > 0) {
    const broad = noStorePrefixes.filter((p) => p.length < 3 || !p.includes("."));
    if (broad.length > 0) {
      const normalized = Array.from(new Set(broad)).sort();
      const warnKey = normalized.join("\u0000");
      if (shouldWarnBroadNoStorePrefixes(warnKey)) {
        const listed = normalized.map((p) => JSON.stringify(p)).join(", ");
        onWarning(
          `withCachingSync(): broad noStorePrefixes ${listed}. ` +
            `Prefixes are matched via op.startsWith(prefix) and may disable caching broadly. ` +
            `Prefer e.g. "kit." / "raw."-style prefixes, or set allowBroadNoStorePrefixes: true to silence this warning.`,
        );
      }
    }
  }

  // Cache policy precedence (Option A):
  // - Built-in unsafe default ops are always "no-store" unless allowUnsafePolicyOverrides.
  // - Otherwise, an explicit policy[op] overrides noStorePrefixes.
  // - noStorePrefixes provide default "no-store" behavior for matched ops.

  const getPolicy = (op: string): CachePolicy => {
    const explicit = policyByOp?.[op];
    const isUnsafeDefault = DEFAULT_UNSAFE_NO_STORE_OPS_LOOKUP[op] === true;

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
