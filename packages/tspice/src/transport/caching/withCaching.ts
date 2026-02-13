import type { SpiceTransport } from "../types.js";

import { createCachePolicy, type CachePolicy } from "./policy.js";

export type { CachePolicy } from "./policy.js";

export const MAX_KEY_SCAN = 10_000;
export const MAX_KEY_LENGTH = 8192;
export const MAX_KEY_STRING_LENGTH = 2048;

const cachingTransportBrand = new WeakSet<object>();

const defaultOnWarning = (message: string): void => {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(message);
  }
};

export type CachingTransport = SpiceTransport & {
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
   * Warning hook for non-fatal configuration issues.
   *
   * When not provided, warnings fall back to `console.warn` (if available).
   */
  onWarning?: (message: string) => void;

  /**
   * Time source for TTL behavior.
   *
   * Useful for tests or custom timekeeping.
   */
  now?: () => number;

  /**
   * Optional per-op cache policy.
   *
   * - `"cache"` => normal caching behavior
   * - `"no-store"` => bypass cache entirely (no key computation, no read/write)
   *
   * Precedence:
   * - Built-in unsafe default ops are always treated as `"no-store"` unless
   *   `allowUnsafePolicyOverrides: true`.
   * - Otherwise, `policy[op]` (when present) overrides `noStorePrefixes`.
   *
   * By default, kernel-mutating ops (e.g. `kit.loadKernel`, `raw.furnsh`) are
   * treated as `"no-store"`.
   */
  policy?: Record<string, CachePolicy>;

  /**
   * Optional list of op-name prefixes that should default to `"no-store"`.
   *
   * Prefix matching uses `op.startsWith(prefix)`, so short / broad prefixes can
   * unintentionally disable caching for many ops. Prefer namespace-style
   * prefixes like `"kit."` / `"raw."` instead of `"k"` / `"kit"`.
   *
   * This is useful for future-proofing (e.g. if new kernel mutation ops are
   * introduced upstream).
   *
   * Note: `policy` takes precedence over `noStorePrefixes` (except for built-in
   * unsafe default ops, which still require `allowUnsafePolicyOverrides`).
   */
  noStorePrefixes?: string[];

  /**
   * If `true`, allows broad `noStorePrefixes` (e.g. `"k"` or `"kit"`).
   *
   * By default, `withCaching()` warns if a prefix looks too broad (length < 3
   * or missing a `.`) to avoid accidentally disabling caching widely.
   */
  allowBroadNoStorePrefixes?: boolean;

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

  if (!cachingTransportBrand.has(t)) return false;

  const v = t as Record<string, unknown>;
  return (
    typeof v.request === "function" &&
    typeof v.clear === "function" &&
    typeof v.dispose === "function"
  );
}

type CacheEntry = {
  promise: Promise<unknown>;
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

type AnyCtor = abstract new (...args: never[]) => object;

type GlobalWithExtras = typeof globalThis & {
  Buffer?: {
    isBuffer?: (v: unknown) => boolean;
  };
  SharedArrayBuffer?: AnyCtor;
};

function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (x === null || typeof x !== "object") return false;

  let proto: unknown;
  try {
    proto = Object.getPrototypeOf(x);
  } catch {
    return false;
  }

  return proto === Object.prototype || proto === null;
}

type ScanBudget = {
  remaining: number;
};

function containsBinaryLikeData(
  value: unknown,
  seen: WeakSet<object>,
  budget: ScanBudget,
): boolean {
  if (value == null) return false;

  const g = globalThis as GlobalWithExtras;

  // Node: Buffer
  if (g.Buffer?.isBuffer?.(value)) return true;

  // ArrayBuffer / TypedArrays / DataView
  if (typeof ArrayBuffer !== "undefined") {
    if (value instanceof ArrayBuffer) return true;
    if (ArrayBuffer.isView(value)) return true;
  }

  // SharedArrayBuffer (when available)
  if (g.SharedArrayBuffer && value instanceof g.SharedArrayBuffer) return true;

  // Blob / File (when available)
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;
  if (typeof File !== "undefined" && value instanceof File) return true;

  if (typeof value === "string") {
    // Treat very large strings like binary payloads: they produce huge keys and
    // are often effectively opaque.
    return value.length > MAX_KEY_STRING_LENGTH;
  }

  const t = typeof value;
  if (t === "function") return true;
  if (t !== "object") return false;

  const obj = value as object;
  if (seen.has(obj)) return false;
  seen.add(obj);

  // Only traverse JSON-like containers: arrays and plain objects with enumerable
  // data properties. Everything else fails closed (disable caching).
  if (Array.isArray(value)) {
    let len: number;
    try {
      len = value.length;
    } catch {
      return true;
    }

    // Scan budget is a *total* budget across args; treat large arrays as
    // non-cacheable (fail closed) rather than doing excessive descriptor work.
    if (len > budget.remaining) return true;

    for (let i = 0; i < len; i++) {
      if (budget.remaining-- <= 0) return true;
      // Detect holes (sparse arrays). JSON.stringify normalizes these to `null`,
      // which can lead to key collisions. Fail closed.
      if (!Object.prototype.hasOwnProperty.call(value, i)) return true;

      let desc: PropertyDescriptor | undefined;
      try {
        desc = Object.getOwnPropertyDescriptor(value, i);
      } catch {
        return true;
      }

      // Should be impossible after hasOwnProperty, but fail closed just in case
      // (e.g. Proxies).
      if (!desc) return true;
      if (desc.get || desc.set) return true;

      if (containsBinaryLikeData(desc.value, seen, budget)) return true;
    }

    return false;
  }

  if (!isPlainObject(value)) return true;

  // Avoid Object.getOwnPropertyDescriptors(value) (bulk descriptor allocation).
  // Scan incrementally and bail early if we hit the global scan budget.
  for (const key of Object.keys(value)) {
    if (budget.remaining-- <= 0) return true;

    let desc: PropertyDescriptor | undefined;
    try {
      desc = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return true;
    }

    if (!desc) return true;
    // `for...in` only enumerates enumerable properties, but keep this as a
    // defensive guardrail.
    if (!desc.enumerable) continue;
    if (desc.get || desc.set) return true;
    if (containsBinaryLikeData(desc.value, seen, budget)) return true;
  }

  return false;
}

/**
 * Default cache key function used by `withCaching()`.
 *
 * Note: for plain objects, cache key stability (and hit rate) depends on object
 * key insertion order, since this uses `JSON.stringify` and does not sort
 * keys.
 */
export function defaultSpiceCacheKey(
  op: string,
  args: unknown[],
): string | null {
  try {
    // Normalize certain ops for better cache hit rates.
    //
    // - `kit.getState({ target, observer, ... })` accepts `string | number` body
    //   refs, but downstream SPICE expects strings. Normalize to strings for
    //   cache keys so `1` and "1" don't diverge.
    const normalizedArgs =
      op === "kit.getState" &&
      args.length === 1 &&
      isPlainObject(args[0]) &&
      (typeof (args[0] as Record<string, unknown>).target === "string" ||
        typeof (args[0] as Record<string, unknown>).target === "number") &&
      (typeof (args[0] as Record<string, unknown>).observer === "string" ||
        typeof (args[0] as Record<string, unknown>).observer === "number")
        ? [
            {
              ...(args[0] as Record<string, unknown>),
              target: String((args[0] as Record<string, unknown>).target),
              observer: String((args[0] as Record<string, unknown>).observer),
            },
          ]
        : args;

    const seen = new WeakSet<object>();
    const budget: ScanBudget = { remaining: MAX_KEY_SCAN };
    for (const arg of normalizedArgs) {
      if (containsBinaryLikeData(arg, seen, budget)) return null;
    }

    const key = JSON.stringify([op, normalizedArgs]);
    if (key.length > MAX_KEY_LENGTH) return null;
    return key;
  } catch {
    // Safer failure mode: if we can't build a stable key, don't cache.
    return null;
  }
}

/**
 * Add a cache layer to a transport.
 *
 * Note: cached values are returned by reference. If a caller mutates the
 * returned object/array, subsequent cache hits will observe that mutation.
 * Treat results as immutable (or clone them yourself) when caching is enabled.
 */
export function withCaching(
  base: SpiceTransport,
  opts?: WithCachingOptions,
): WithCachingResult {
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
    wrapperName: "withCaching()",
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

  const request = (op: string, args: unknown[]): Promise<unknown> => {
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
            current.expiresAt = now() + ttlMs;
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

  const transport = { request, clear, dispose };

  // Preserve any extra properties on the base transport (e.g. testing hooks)
  // while still allowing us to override the core methods.
  //
  // This also keeps `instanceof`/prototype checks (if any) behaving as users
  // might expect.
  const transportWithProto = Object.assign(Object.create(base), transport);

  cachingTransportBrand.add(transportWithProto);
  return transportWithProto;
}
