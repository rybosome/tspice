import { describe, expect, it } from "vitest";

import {
  defaultSpiceCacheKey,
  isCachingTransport,
  withCaching,
} from "../src/transport/caching/withCaching.js";
import type { SpiceTransport } from "../src/transport/types.js";

describe("withCaching()", () => {
  it("returns base transport by identity when caching is disabled", () => {
    const base: SpiceTransport = {
      request: async () => 1,
    };

    const transport = withCaching(base, { maxEntries: 0 });
    expect(transport).toBe(base);
    expect(isCachingTransport(transport)).toBe(false);
  });

  it("dedupes concurrent callers by caching the in-flight promise", async () => {
    let calls = 0;
    let resolve!: (v: unknown) => void;

    const base: SpiceTransport = {
      request: () => {
        calls += 1;
        return new Promise((r) => {
          resolve = r;
        });
      },
    };

    const transport = withCaching(base, { maxEntries: Infinity, now: () => 0 });
    expect(isCachingTransport(transport)).toBe(true);

    const p1 = transport.request("raw.foo", [1]);
    const p2 = transport.request("raw.foo", [1]);
    expect(p1).toBe(p2);
    expect(calls).toBe(1);

    resolve("ok");
    await expect(p1).resolves.toBe("ok");
    await expect(p2).resolves.toBe("ok");
    expect(calls).toBe(1);
  });

  it("does not cache rejections", async () => {
    let calls = 0;
    const base: SpiceTransport = {
      request: async () => {
        calls += 1;
        throw new Error("boom");
      },
    };

    const transport = withCaching(base, { maxEntries: Infinity, now: () => 0 });

    await expect(transport.request("raw.fail", [1])).rejects.toThrow("boom");
    await expect(transport.request("raw.fail", [1])).rejects.toThrow("boom");
    expect(calls).toBe(2);
  });

  it("treats kernel-mutating ops as no-store by default (policy override requires allowUnsafePolicyOverrides)", async () => {
    {
      let calls = 0;
      const base: SpiceTransport = {
        request: async () => {
          calls += 1;
          return calls;
        },
      };

      const transport = withCaching(base, { maxEntries: Infinity, now: () => 0 });
      await expect(transport.request("kit.loadKernel", ["/a.tls"])).resolves.toBe(1);
      await expect(transport.request("kit.loadKernel", ["/a.tls"])).resolves.toBe(2);
      expect(calls).toBe(2);
    }

    {
      let calls = 0;
      const base: SpiceTransport = {
        request: async () => {
          calls += 1;
          return calls;
        },
      };

      const transport = withCaching(base, {
        maxEntries: Infinity,
        now: () => 0,
        policy: { "kit.loadKernel": "cache" },
        allowUnsafePolicyOverrides: true,
      });
      await expect(transport.request("kit.loadKernel", ["/a.tls"])).resolves.toBe(1);
      await expect(transport.request("kit.loadKernel", ["/a.tls"])).resolves.toBe(1);
      expect(calls).toBe(1);
    }
  });

  it("normalizes kit.getState target/observer to strings in default cache keys", () => {
    const key1 = defaultSpiceCacheKey("kit.getState", [
      {
        target: 399,
        observer: 10,
        at: 0,
      },
    ]);

    const key2 = defaultSpiceCacheKey("kit.getState", [
      {
        target: "399",
        observer: "10",
        at: 0,
      },
    ]);

    expect(key1).toBe(key2);
  });

  it("disables caching when args contain binary-like data", () => {
    expect(defaultSpiceCacheKey("raw.foo", [new Uint8Array([1, 2, 3])])).toBe(null);
  });
});
