export type CachePolicy = "cache" | "no-store";

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

export type CreateCachePolicyOptions = {
  /** e.g. `withCaching()` or `withCachingSync()` (used for warning messages). */
  wrapperName: string;
  onWarning: (message: string) => void;

  policyByOp?: Record<string, CachePolicy> | undefined;
  noStorePrefixes?: string[] | undefined;

  allowBroadNoStorePrefixes?: boolean;
  allowUnsafePolicyOverrides?: boolean;
};

/**
 * Creates a cache-policy resolver with the same precedence / guardrails used by
 * `withCaching()` and `withCachingSync()`.
 */
export function createCachePolicy(opts: CreateCachePolicyOptions): (op: string) => CachePolicy {
  // Warning de-dupe (per wrapper instance).
  const warnedBroadNoStorePrefixSets = new Set<string>();
  const shouldWarnBroadNoStorePrefixes = (warnKey: string): boolean => {
    if (warnedBroadNoStorePrefixSets.has(warnKey)) return false;
    warnedBroadNoStorePrefixSets.add(warnKey);
    return true;
  };

  // Normalize once up-front so callers can't accidentally pass whitespace or
  // an empty string that behaves like a wildcard (`op.startsWith("") === true`).
  const noStorePrefixes = opts.noStorePrefixes?.map((p) => p.trim()).filter((p) => p.length > 0);

  const allowUnsafePolicyOverrides = opts.allowUnsafePolicyOverrides === true;
  const allowBroadNoStorePrefixes = opts.allowBroadNoStorePrefixes === true;

  if (!allowBroadNoStorePrefixes && noStorePrefixes && noStorePrefixes.length > 0) {
    const broad = noStorePrefixes.filter((p) => p.length < 3 || !p.includes("."));
    if (broad.length > 0) {
      const normalized = Array.from(new Set(broad)).sort();
      const warnKey = normalized.join("\u0000");
      if (shouldWarnBroadNoStorePrefixes(warnKey)) {
        const listed = normalized.map((p) => JSON.stringify(p)).join(", ");
        opts.onWarning(
          `${opts.wrapperName}: broad noStorePrefixes ${listed}. ` +
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

  return (op: string): CachePolicy => {
    const explicit = opts.policyByOp?.[op];
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
}
