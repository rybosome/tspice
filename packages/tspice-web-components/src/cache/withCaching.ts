import type { SpiceTransport } from "../types.js";

export type CachePolicy = "cache" | "no-store";

export const MAX_KEY_SCAN = 10_000;

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

const DEFAULT_UNSAFE_NO_STORE_OPS_LOOKUP: Record<string, true> = Object.freeze({
  "kit.loadKernel": true,
  "kit.unloadKernel": true,
  "kit.kclear": true,
  "raw.furnsh": true,
  "raw.unload": true,
  "raw.kclear": true,
});

const warnedBroadNoStorePrefixSets = new Set<string>();

const matchesAnyPrefix = (op: string, prefixes: readonly string[] | undefined): boolean => {
  if (!prefixes || prefixes.length === 0) return false;
  for (const prefix of prefixes) {
    if (prefix && op.startsWith(prefix)) return true;
  }
  return false;
};

export const CACHING_TRANSPORT_BRAND: unique symbol = Symbol.for(
  "@rybosome/tspice-web-components:CACHING_TRANSPORT_BRAND",
);

export type CachingTransport = SpiceTransport & {
  readonly [CACHING_TRANSPORT_BRAND]: true;
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

  const v = t as Record<string | symbol, unknown>;
  return (
    v[CACHING_TRANSPORT_BRAND] === true &&
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

function containsBinaryLikeData(value: unknown, seen: WeakSet<object>): boolean {
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

    // Avoid O(n) descriptor allocation for large arrays. Treat them as
    // non-cacheable (fail closed) instead.
    if (len > MAX_KEY_SCAN) return true;

    for (let i = 0; i < len; i++) {
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

      if (containsBinaryLikeData(desc.value, seen)) return true;
    }

    return false;
  }

  if (!isPlainObject(value)) return true;

  let descs: Record<string, PropertyDescriptor>;
  try {
    descs = Object.getOwnPropertyDescriptors(value);
  } catch {
    return true;
  }

  for (const desc of Object.values(descs)) {
    if (!desc.enumerable) continue;
    if (desc.get || desc.set) return true;
    if (containsBinaryLikeData(desc.value, seen)) return true;
  }

  return false;
}

export function defaultSpiceCacheKey(op: string, args: unknown[]): string | null {
  try {
    const seen = new WeakSet<object>();
    for (const arg of args) {
      if (containsBinaryLikeData(arg, seen)) return null;
    }

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
  const now = opts?.now ?? Date.now;
  const onWarning =
    opts?.onWarning ??
    ((message: string) => {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn(message);
      }
    });

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
      if (!warnedBroadNoStorePrefixSets.has(warnKey)) {
        warnedBroadNoStorePrefixSets.add(warnKey);

        const listed = normalized.map((p) => JSON.stringify(p)).join(", ");
        onWarning(
          `withCaching(): broad noStorePrefixes ${listed}. ` +
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

  return {
    [CACHING_TRANSPORT_BRAND]: true,
    request,
    clear,
    dispose,
  };
}
