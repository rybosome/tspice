import { afterEach, describe, expect, it, vi } from "vitest";

import { getGlobal } from "./helpers/getGlobal.js";

// Keep in sync with the internal MAX_KEY_SCAN guardrail in withCaching.ts.
const DEFAULT_MAX_KEY_SCAN = 10_000;

describe("withCaching()", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("caches forever when ttlMs is undefined (LRU-bounded)", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    let calls = 0;
    const base = {
      request: vi.fn(async () => ++calls),
    };

    const cached = withCaching(base);

    expect(await cached.request("op", [1])).toBe(1);
    expect(await cached.request("op", [1])).toBe(1);

    expect(base.request).toHaveBeenCalledTimes(1);

    if (isCachingTransport(cached)) cached.dispose();
  });

  it("brands the caching transport via a private WeakSet (non-forgeable)", async () => {
    const { isCachingTransport, withCaching } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components",
    );

    const base = {
      request: vi.fn(async () => 123),
    };

    const cached = withCaching(base);
    expect(isCachingTransport(cached)).toBe(true);
    if (!isCachingTransport(cached)) throw new Error("expected caching transport");

    // Objects that merely match the method shape should not be treated as
    // caching transports.
    const forged = {
      request: vi.fn(async () => 123),
      clear: vi.fn(),
      dispose: vi.fn(),
    };

    expect(isCachingTransport(forged)).toBe(false);

    cached.dispose();
  });

  it("dedupes in-flight requests", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    let resolve!: (value: number) => void;
    const pending = new Promise<number>((res) => {
      resolve = res;
    });

    const base = {
      request: vi.fn(() => pending),
    };

    const cached = withCaching(base);

    const p1 = cached.request("op", [1]);
    const p2 = cached.request("op", [1]);

    expect(p2).toBe(p1);
    expect(base.request).toHaveBeenCalledTimes(1);

    resolve(123);

    expect(await p1).toBe(123);
    expect(await p2).toBe(123);

    if (isCachingTransport(cached)) cached.dispose();
  });

  it("does not cache rejections", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const base = {
      request: vi
        .fn<[], Promise<unknown>>()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(123),
    };

    const cached = withCaching(base);

    await expect(cached.request("op", [])).rejects.toThrow("boom");
    expect(await cached.request("op", [])).toBe(123);

    expect(base.request).toHaveBeenCalledTimes(2);

    if (isCachingTransport(cached)) cached.dispose();
  });

  it("disables caching when ttlMs <= 0", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const base = {
      request: vi.fn(async () => 123),
    };

    const cached = withCaching(base, { ttlMs: 0 });

    // No-op mode should preserve input identity and avoid allocating wrapper state.
    expect(cached).toBe(base);

    await cached.request("op", [1]);
    await cached.request("op", [1]);

    expect(base.request).toHaveBeenCalledTimes(2);
  });

  it("skips caching when the default key cannot be generated", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const base = {
      request: vi.fn(async () => 123),
    };

    const cached = withCaching(base);

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    await cached.request("op", [cyclic]);
    await cached.request("op", [cyclic]);

    expect(base.request).toHaveBeenCalledTimes(2);

    if (isCachingTransport(cached)) cached.dispose();
  });

  it("defaultSpiceCacheKey returns null for binary-like args", async () => {
    const { defaultSpiceCacheKey } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components",
    );

    type UnknownCtor = new (...args: unknown[]) => unknown;

    const SharedArrayBufferCtor = getGlobal("SharedArrayBuffer") as UnknownCtor | undefined;
    const BufferCtor = getGlobal("Buffer") as
      | undefined
      | {
          from?: (data: unknown) => unknown;
        };
    const FileCtor = getGlobal("File") as UnknownCtor | undefined;

    const cases: Array<{ name: string; value: unknown | undefined }> = [
      { name: "ArrayBuffer", value: new ArrayBuffer(1) },
      { name: "DataView", value: new DataView(new ArrayBuffer(1)) },
      { name: "Uint8Array", value: new Uint8Array([1, 2, 3]) },
      {
        name: "SharedArrayBuffer",
        value: SharedArrayBufferCtor ? new SharedArrayBufferCtor(1) : undefined,
      },
      { name: "Buffer", value: BufferCtor?.from ? BufferCtor.from([1, 2, 3]) : undefined },
      {
        name: "Blob",
        value:
          typeof Blob !== "undefined" ? new Blob([new Uint8Array([1, 2, 3])]) : undefined,
      },
      {
        name: "File",
        value:
          FileCtor && typeof Blob !== "undefined"
            ? // Note: `File` extends `Blob` where present.
              new FileCtor([new Uint8Array([1, 2, 3])], "a.bin")
            : undefined,
      },
    ];

    for (const { name, value } of cases) {
      if (value === undefined) continue;

      expect(defaultSpiceCacheKey("op", [value]), name).toBeNull();
      expect(defaultSpiceCacheKey("op", [{ nested: value }]), `${name} (nested)`).toBeNull();
    }
  });

  it("defaultSpiceCacheKey returns null for sparse arrays, accessor arrays, and large arrays", async () => {
    const { defaultSpiceCacheKey } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components",
    );

    // Sparse/accessor arrays as *values* should be rejected.
    const sparse: unknown[] = [];
    sparse[1] = 1;
    expect(defaultSpiceCacheKey("op", [sparse])).toBeNull();

    let getterCalls = 0;
    const accessor: unknown[] = [];
    Object.defineProperty(accessor, 0, {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 123;
      },
    });

    expect(defaultSpiceCacheKey("op", [accessor])).toBeNull();
    expect(getterCalls).toBe(0);

    // Sparse/accessor `args` arrays should also be rejected since the key is
    // based on the full `[op, args]` tuple.
    const sparseArgs: unknown[] = [];
    sparseArgs[1] = 1;
    expect(defaultSpiceCacheKey("op", sparseArgs)).toBeNull();

    let argsGetterCalls = 0;
    const accessorArgs: unknown[] = [];
    Object.defineProperty(accessorArgs, 0, {
      enumerable: true,
      get() {
        argsGetterCalls += 1;
        return 123;
      },
    });
    expect(defaultSpiceCacheKey("op", accessorArgs)).toBeNull();
    expect(argsGetterCalls).toBe(0);

    const big = new Array(DEFAULT_MAX_KEY_SCAN + 1).fill(0);
    expect(defaultSpiceCacheKey("op", [big])).toBeNull();
  });

  it("defaultSpiceCacheKey returns null for large plain objects (scan budget)", async () => {
    const { defaultSpiceCacheKey } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components",
    );

    const big: Record<string, number> = {};
    for (let i = 0; i < DEFAULT_MAX_KEY_SCAN + 1; i++) {
      big[`k${i}`] = i;
    }

    expect(defaultSpiceCacheKey("op", [big])).toBeNull();
  });

  it("bypasses cache when args contain binary-like data", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    let calls = 0;
    const base = {
      request: vi.fn(async () => ++calls),
    };

    const cached = withCaching(base);

    const payload = {
      nested: {
        bytes: new Uint8Array([1, 2, 3]),
      },
    };

    expect(await cached.request("op", [payload])).toBe(1);
    expect(await cached.request("op", [payload])).toBe(2);

    expect(base.request).toHaveBeenCalledTimes(2);

    if (isCachingTransport(cached)) cached.dispose();
  });

  it("can sweep expired entries periodically (opt-in)", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    vi.useFakeTimers();
    vi.setSystemTime(0);

    let calls = 0;
    const base = {
      request: vi.fn(async () => ++calls),
    };

    const cached = withCaching(base, {
      ttlMs: 10,
      sweepIntervalMs: 5,
    });

    expect(await cached.request("op", [])).toBe(1);
    expect(await cached.request("op", [])).toBe(1);

    vi.advanceTimersByTime(25);

    // After the sweep runs, the entry should be removed and a new request should hit base.
    expect(await cached.request("op", [])).toBe(2);

    if (isCachingTransport(cached)) cached.dispose();
  });

  it("defaults to no-store for kernel-mutating ops", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const key = vi.fn(() => "k");
    const base = {
      request: vi.fn(async () => 123),
    };

    const cached = withCaching(base, { key });

    const noStoreOps = [
      "kit.loadKernel",
      "kit.unloadKernel",
      "kit.kclear",
      "raw.furnsh",
      "raw.unload",
      "raw.kclear",
    ];

    for (const op of noStoreOps) {
      await cached.request(op, [
        // Include a Uint8Array to ensure we don't stringify / key large binary payloads.
        { path: "/kernels/a", bytes: new Uint8Array([1, 2, 3]) },
      ]);
      await cached.request(op, [{ path: "/kernels/a", bytes: new Uint8Array([1, 2, 3]) }]);
    }

    expect(base.request).toHaveBeenCalledTimes(noStoreOps.length * 2);
    expect(key).not.toHaveBeenCalled();

    if (isCachingTransport(cached)) cached.dispose();
  });


  it("treats built-in unsafe defaults as exact-match (not prefix)", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const key = vi.fn(() => "k");
    let calls = 0;
    const base = {
      request: vi.fn(async () => ++calls),
    };

    const cached = withCaching(base, { key });

    // `kit.loadKernel` is a built-in default no-store op. We should NOT
    // accidentally treat `kit.loadKernelExtra` (a different op) as no-store just
    // because it shares a prefix.
    expect(await cached.request("kit.loadKernelExtra", [])).toBe(1);
    expect(await cached.request("kit.loadKernelExtra", [])).toBe(1);

    expect(base.request).toHaveBeenCalledTimes(1);
    expect(key).toHaveBeenCalledTimes(2);

    if (isCachingTransport(cached)) cached.dispose();
  });

  it("treats user-provided noStorePrefixes as prefixes", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const key = vi.fn(() => "k");
    const base = {
      request: vi.fn(async () => 123),
    };

    const cached = withCaching(base, {
      key,
      noStorePrefixes: ["kit.loadKernel"],
    });

    await cached.request("kit.loadKernelExtra", []);
    await cached.request("kit.loadKernelExtra", []);

    expect(base.request).toHaveBeenCalledTimes(2);
    expect(key).not.toHaveBeenCalled();

    if (isCachingTransport(cached)) cached.dispose();
  });

  it("policy overrides noStorePrefixes, but cannot override unsafe defaults without allowUnsafePolicyOverrides", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const key = vi.fn(() => "k");
    let calls = 0;
    const base = {
      request: vi.fn(async () => ++calls),
    };

    const cached = withCaching(base, {
      key,
      noStorePrefixes: ["kit."],
      policy: {
        // Should override noStorePrefixes match.
        "kit.utcToEt": "cache",
        // Should NOT override built-in unsafe default without allowUnsafePolicyOverrides.
        "raw.kclear": "cache",
      },
    });

    expect(await cached.request("kit.utcToEt", [])).toBe(1);
    expect(await cached.request("kit.utcToEt", [])).toBe(1);

    expect(await cached.request("raw.kclear", [])).toBe(2);
    expect(await cached.request("raw.kclear", [])).toBe(3);

    expect(base.request).toHaveBeenCalledTimes(3);
    expect(key).toHaveBeenCalledTimes(2);

    if (isCachingTransport(cached)) cached.dispose();
  });

  it("warns for overly broad noStorePrefixes by default (deduped)", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const onWarning1 = vi.fn();

    const base = {
      request: vi.fn(async () => 123),
    };

    const cached1 = withCaching(base, {
      noStorePrefixes: ["k"],
      onWarning: onWarning1,
    });

    expect(onWarning1).toHaveBeenCalledTimes(1);
    expect(onWarning1.mock.calls[0]?.[0]).toMatch(/allowBroadNoStorePrefixes/i);

    if (isCachingTransport(cached1)) cached1.dispose();

    const onWarning2 = vi.fn();
    const cached2 = withCaching(base, {
      // Same normalized prefix set => warn-once.
      noStorePrefixes: [" k ", "k"],
      onWarning: onWarning2,
    });

    expect(onWarning2).not.toHaveBeenCalled();

    if (isCachingTransport(cached2)) cached2.dispose();
  });

  it("dedupes warnings by full normalized prefix set (not just broad subset)", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const base = {
      request: vi.fn(async () => 123),
    };

    const onWarning1 = vi.fn();
    const cached1 = withCaching(base, {
      noStorePrefixes: ["zz", "kit."],
      onWarning: onWarning1,
    });

    expect(onWarning1).toHaveBeenCalledTimes(1);
    if (isCachingTransport(cached1)) cached1.dispose();

    const onWarning2 = vi.fn();
    const cached2 = withCaching(base, {
      // Same broad subset ("zz"), but different overall prefix config.
      noStorePrefixes: ["zz", "raw."],
      onWarning: onWarning2,
    });

    expect(onWarning2).toHaveBeenCalledTimes(1);
    if (isCachingTransport(cached2)) cached2.dispose();
  });

  it("allows broad noStorePrefixes when explicitly opted-in", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const onWarning = vi.fn();

    const key = vi.fn(() => "k");
    const base = {
      request: vi.fn(async () => 123),
    };

    const cached = withCaching(base, {
      key,
      noStorePrefixes: ["kit"],
      allowBroadNoStorePrefixes: true,
      onWarning,
    });

    expect(onWarning).not.toHaveBeenCalled();

    await cached.request("kit.utcToEt", []);
    await cached.request("kit.utcToEt", []);

    expect(base.request).toHaveBeenCalledTimes(2);
    expect(key).not.toHaveBeenCalled();

    if (isCachingTransport(cached)) cached.dispose();
  });
  it("supports per-op cache policy overrides", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    // Guardrail: forcing cache for built-in unsafe default no-store ops requires
    // an explicit opt-in.
    const key1 = vi.fn(() => "k");
    let calls1 = 0;
    const base1 = {
      request: vi.fn(async () => ++calls1),
    };

    const cached1 = withCaching(base1, {
      key: key1,
      policy: {
        "raw.kclear": "cache",
      },
    });

    expect(await cached1.request("raw.kclear", [])).toBe(1);
    expect(await cached1.request("raw.kclear", [])).toBe(2);
    expect(base1.request).toHaveBeenCalledTimes(2);
    expect(key1).not.toHaveBeenCalled();
    if (isCachingTransport(cached1)) cached1.dispose();

    const key2 = vi.fn(() => "k");
    let calls2 = 0;
    const base2 = {
      request: vi.fn(async () => ++calls2),
    };

    const cached2 = withCaching(base2, {
      allowUnsafePolicyOverrides: true,
      key: key2,
      policy: {
        "raw.kclear": "cache",
      },
    });

    expect(await cached2.request("raw.kclear", [])).toBe(1);
    expect(await cached2.request("raw.kclear", [])).toBe(1);
    expect(base2.request).toHaveBeenCalledTimes(1);
    expect(key2).toHaveBeenCalledTimes(2);
    if (isCachingTransport(cached2)) cached2.dispose();

    // Can force bypass (and skip key computation) for arbitrary ops.
    const key3 = vi.fn(() => "k");
    const base3 = {
      request: vi.fn(async () => 123),
    };

    const cached3 = withCaching(base3, {
      key: key3,
      policy: {
        op: "no-store",
      },
    });

    await cached3.request("op", [1]);
    await cached3.request("op", [1]);
    expect(base3.request).toHaveBeenCalledTimes(2);
    expect(key3).not.toHaveBeenCalled();
    if (isCachingTransport(cached3)) cached3.dispose();
  });

  it("supports noStorePrefixes", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const key = vi.fn(() => "k");
    const base = {
      request: vi.fn(async () => 123),
    };

    const cached = withCaching(base, {
      key,
      noStorePrefixes: ["  unsafe.  ", "", "   "],
    });

    await cached.request("unsafe.op", []);
    await cached.request("unsafe.op", []);
    expect(base.request).toHaveBeenCalledTimes(2);
    expect(key).not.toHaveBeenCalled();

    if (isCachingTransport(cached)) cached.dispose();
  });

  it("does not treat empty noStorePrefixes as a wildcard", async () => {
    const { isCachingTransport, withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const key = vi.fn(() => "k");
    let calls = 0;
    const base = {
      request: vi.fn(async () => ++calls),
    };

    const cached = withCaching(base, {
      key,
      // If an empty string were treated as a real prefix, `startsWith("")`
      // would match everything and accidentally disable caching broadly.
      noStorePrefixes: [""],
    });

    expect(await cached.request("op", [])).toBe(1);
    expect(await cached.request("op", [])).toBe(1);
    expect(base.request).toHaveBeenCalledTimes(1);
    expect(key).toHaveBeenCalledTimes(2);

    if (isCachingTransport(cached)) cached.dispose();
  });
});
