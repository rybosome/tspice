import type { SpiceTransport } from "../types.js";

type CacheEntry = {
  promise: Promise<unknown>;
  /** Epoch ms (exclusive) */
  expiresAt?: number;
};

function defaultKey(op: string, args: unknown[]): string {
  try {
    return JSON.stringify([op, args]);
  } catch {
    // Best-effort fallback; callers can provide a deterministic key() if needed.
    return `${op}(${args.map((a) => String(a)).join(",")})`;
  }
}

export function withCaching(
  base: SpiceTransport,
  opts?: {
    maxEntries?: number;
    ttlMs?: number;
    key?: (op: string, args: unknown[]) => string;
  },
): SpiceTransport {
  const keyFn = opts?.key ?? defaultKey;
  const maxEntries = opts?.maxEntries ?? 1000;
  const ttlMs = opts?.ttlMs;

  const cache = new Map<string, CacheEntry>();

  const isExpired = (entry: CacheEntry, now: number): boolean =>
    entry.expiresAt !== undefined && entry.expiresAt <= now;

  const cleanupExpired = (now: number): void => {
    if (ttlMs === undefined) return;

    for (const [k, entry] of cache) {
      if (isExpired(entry, now)) cache.delete(k);
    }
  };

  const touch = (k: string, entry: CacheEntry): void => {
    cache.delete(k);
    cache.set(k, entry);
  };

  const enforceMaxEntries = (): void => {
    if (!Number.isFinite(maxEntries) || maxEntries <= 0) return;

    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (oldestKey === undefined) return;
      cache.delete(oldestKey);
    }
  };

  return {
    request(op, args) {
      const k = keyFn(op, args);
      const now = Date.now();

      cleanupExpired(now);

      const existing = cache.get(k);
      if (existing && !isExpired(existing, now)) {
        touch(k, existing);
        return existing.promise;
      }

      if (existing) cache.delete(k);

      const entry: CacheEntry = {
        promise: Promise.resolve(undefined),
      };

      entry.promise = base.request(op, args).then(
        (value) => {
          // Extend TTL from the time we actually have a value.
          if (ttlMs !== undefined && cache.get(k) === entry) {
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

      cache.set(k, entry);
      enforceMaxEntries();

      return entry.promise;
    },
  };
}
