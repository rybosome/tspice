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

    cached.dispose();
  });

  it("disables caching when ttlMs <= 0", async () => {
    const { withCaching } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const base = {
      request: vi.fn(async () => 123),
    };

    const cached = withCaching(base, { ttlMs: 0 });

    await cached.request("op", [1]);
    await cached.request("op", [1]);

    expect(base.request).toHaveBeenCalledTimes(2);

    cached.dispose();
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

    cached.dispose();
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

    cached.dispose();
  });
});
