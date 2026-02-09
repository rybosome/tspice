import { afterEach, describe, expect, it, vi } from "vitest";

describe("withCaching()", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("caches forever when ttlMs is undefined (LRU-bounded)", async () => {
    const { withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    let calls = 0;
    const base = {
      request: vi.fn(async () => ++calls),
    };

    const cached = withCaching(base);

    expect(await cached.request("op", [1])).toBe(1);
    expect(await cached.request("op", [1])).toBe(1);

    expect(base.request).toHaveBeenCalledTimes(1);

    if ("dispose" in cached) cached.dispose();
  });

  it("disables caching when ttlMs <= 0", async () => {
    const { withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

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
    const { withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const base = {
      request: vi.fn(async () => 123),
    };

    const cached = withCaching(base);

    const cyclic: any = {};
    cyclic.self = cyclic;

    await cached.request("op", [cyclic]);
    await cached.request("op", [cyclic]);

    expect(base.request).toHaveBeenCalledTimes(2);

    if ("dispose" in cached) cached.dispose();
  });

  it("can sweep expired entries periodically (opt-in)", async () => {
    const { withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

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

    if ("dispose" in cached) cached.dispose();
  });

  it("defaults to no-store for kernel-mutating ops", async () => {
    const { withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

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

    if ("dispose" in cached) cached.dispose();
  });

  it("supports per-op cache policy overrides", async () => {
    const { withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    // Can force caching even for default no-store ops.
    let calls1 = 0;
    const base1 = {
      request: vi.fn(async () => ++calls1),
    };

    const cached1 = withCaching(base1, {
      policy: {
        "raw.kclear": "cache",
      },
    });

    expect(await cached1.request("raw.kclear", [])).toBe(1);
    expect(await cached1.request("raw.kclear", [])).toBe(1);
    expect(base1.request).toHaveBeenCalledTimes(1);
    if ("dispose" in cached1) cached1.dispose();

    // Can force bypass (and skip key computation) for arbitrary ops.
    const key2 = vi.fn(() => "k");
    const base2 = {
      request: vi.fn(async () => 123),
    };

    const cached2 = withCaching(base2, {
      key: key2,
      policy: {
        op: "no-store",
      },
    });

    await cached2.request("op", [1]);
    await cached2.request("op", [1]);
    expect(base2.request).toHaveBeenCalledTimes(2);
    expect(key2).not.toHaveBeenCalled();
    if ("dispose" in cached2) cached2.dispose();
  });
});
