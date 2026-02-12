import { describe, expect, it } from "vitest";

import { isCachingTransportSync, withCachingSync } from "../src/transport/caching/withCachingSync.js";
import type { SpiceTransportSync } from "../src/transport/types.js";

describe("withCachingSync()", () => {
  it("expires entries via ttlMs (absolute, non-sliding)", () => {
    let t = 1000;
    const now = () => t;

    let calls = 0;
    const base: SpiceTransportSync = {
      request: (op, args) => {
        calls++;
        return `${op}:${JSON.stringify(args)}:${calls}`;
      },
    };

    const transport = withCachingSync(base, {
      ttlMs: 10,
      now,
      maxEntries: Infinity,
    });
    expect(isCachingTransportSync(transport)).toBe(true);

    const v1 = transport.request("raw.foo", [1]);
    expect(v1).toBe("raw.foo:[1]:1");
    expect(calls).toBe(1);

    t = 1005;
    const v2 = transport.request("raw.foo", [1]);
    expect(v2).toBe(v1);
    expect(calls).toBe(1);

    // TTL is exclusive (expiresAt <= now is expired), and does not refresh on access.
    t = 1010;
    const v3 = transport.request("raw.foo", [1]);
    expect(v3).toBe("raw.foo:[1]:2");
    expect(calls).toBe(2);
  });

  it("evicts least-recently-used entries when maxEntries is exceeded", () => {
    let calls = 0;
    const base: SpiceTransportSync = {
      request: (op, args) => {
        calls++;
        return `${op}:${JSON.stringify(args)}:${calls}`;
      },
    };

    const transport = withCachingSync(base, {
      maxEntries: 2,
      now: () => 0,
    });
    expect(isCachingTransportSync(transport)).toBe(true);

    const a1 = transport.request("raw.a", [1]);
    const b1 = transport.request("raw.b", [1]);
    expect(calls).toBe(2);

    // Touch `a` so `b` becomes the LRU.
    expect(transport.request("raw.a", [1])).toBe(a1);
    expect(calls).toBe(2);

    const c1 = transport.request("raw.c", [1]);
    expect(calls).toBe(3);

    // After inserting `c`, `b` was LRU and should be evicted, but `a` and `c`
    // should still be present.
    expect(transport.request("raw.a", [1])).toBe(a1);
    expect(calls).toBe(3);

    expect(transport.request("raw.c", [1])).toBe(c1);
    expect(calls).toBe(3);

    const b2 = transport.request("raw.b", [1]);
    expect(b2).not.toBe(b1);
    expect(calls).toBe(4);
  });

  it("treats kernel-mutating ops as no-store by default (policy override requires allowUnsafePolicyOverrides)", () => {
    {
      let calls = 0;
      const base: SpiceTransportSync = {
        request: () => {
          calls++;
          return calls;
        },
      };

      const transport = withCachingSync(base, { maxEntries: Infinity, now: () => 0 });
      expect(transport.request("kit.loadKernel", ["/a.tls"])).toBe(1);
      expect(transport.request("kit.loadKernel", ["/a.tls"])).toBe(2);
      expect(calls).toBe(2);
    }

    {
      let calls = 0;
      const base: SpiceTransportSync = {
        request: () => {
          calls++;
          return calls;
        },
      };

      const transport = withCachingSync(base, {
        maxEntries: Infinity,
        now: () => 0,
        policy: { "kit.loadKernel": "cache" },
      });
      expect(transport.request("kit.loadKernel", ["/a.tls"])).toBe(1);
      expect(transport.request("kit.loadKernel", ["/a.tls"])).toBe(2);
      expect(calls).toBe(2);
    }

    {
      let calls = 0;
      const base: SpiceTransportSync = {
        request: () => {
          calls++;
          return calls;
        },
      };

      const transport = withCachingSync(base, {
        maxEntries: Infinity,
        now: () => 0,
        policy: { "kit.loadKernel": "cache" },
        allowUnsafePolicyOverrides: true,
      });
      expect(transport.request("kit.loadKernel", ["/a.tls"])).toBe(1);
      expect(transport.request("kit.loadKernel", ["/a.tls"])).toBe(1);
      expect(calls).toBe(1);
    }
  });

  it("does not cache throws", () => {
    let calls = 0;
    const base: SpiceTransportSync = {
      request: () => {
        calls++;
        throw new Error("boom");
      },
    };

    const transport = withCachingSync(base, { maxEntries: Infinity, now: () => 0 });

    expect(() => transport.request("raw.fail", [1])).toThrow("boom");
    expect(() => transport.request("raw.fail", [1])).toThrow("boom");
    expect(calls).toBe(2);
  });
});
