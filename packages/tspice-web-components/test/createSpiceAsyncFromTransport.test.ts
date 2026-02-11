import { describe, expect, it, vi } from "vitest";

describe("createSpiceAsyncFromTransport()", () => {
  it("blocks introspection/dangerous keys and caches method fns", async () => {
    const { createSpiceAsyncFromTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const transport = {
      request: vi.fn(async () => "ok"),
    };

    const spice = createSpiceAsyncFromTransport(transport);

    const rawProxy = spice.raw as any;

    expect(rawProxy.then).toBeUndefined();
    expect(rawProxy.__proto__).toBeUndefined();
    expect(rawProxy.constructor).toBeUndefined();
    expect(rawProxy.toJSON).toBeUndefined();

    expect(String(spice.raw)).toContain("SpiceAsync.raw");
    expect(transport.request).toHaveBeenCalledTimes(0);

    const f1 = spice.kit.utcToEt;
    const f2 = spice.kit.utcToEt;
    expect(f1).toBe(f2);

    await spice.kit.utcToEt("2026-01-01T00:00:00Z");
    expect(transport.request).toHaveBeenCalledWith("kit.utcToEt", ["2026-01-01T00:00:00Z"]);
  });

  it("LRU-evicts cached method wrappers", async () => {
    const { createSpiceAsyncFromTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const transport = {
      request: vi.fn(async () => "ok"),
    };

    const spice = createSpiceAsyncFromTransport(transport);
    const kit = spice.kit as any;

    const hot1 = kit.utcToEt;

    // Fill the bounded cache to capacity.
    for (let i = 0; i < 1023; i++) {
      void kit[`m${i}`];
    }

    // Touch the hot key again so it becomes most-recently-used.
    const hot2 = kit.utcToEt;
    expect(hot2).toBe(hot1);

    // Trigger one eviction.
    void kit.zzz;

    // The hot key should still be cached (LRU, not FIFO).
    const hot3 = kit.utcToEt;
    expect(hot3).toBe(hot1);
  });

  it("matches the proxy allowlist regex for current Spice surfaces", async () => {
    const { createSpice } = await import(/* @vite-ignore */ "@rybosome/tspice");
    const { createFakeBackend } = await import(/* @vite-ignore */ "@rybosome/tspice-backend-fake");

    const spice = await createSpice({
      // `backend` is required by the API even when providing a backend instance.
      backend: "wasm",
      backendInstance: createFakeBackend(),
    });

    const allowlist = /^[A-Za-z_$][\w$]*$/;

    for (const [ns, obj] of Object.entries({ raw: spice.raw, kit: spice.kit })) {
      for (const key of Object.keys(obj)) {
        if (typeof (obj as any)[key] !== "function") continue;
        expect(key, `${ns}.${key}`).toMatch(allowlist);
      }
    }
  });
});
