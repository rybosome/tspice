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
});
