import { describe, expect, it, vi } from "vitest";

import type { KernelSource } from "@rybosome/tspice-backend-contract";

import { kernels } from "../src/kernels/kernels.js";
import type { NaifKernelId } from "../src/kernels/naifKernelId.js";
import type { FetchLike, KernelPack, ResponseLike } from "../src/kernels/kernelPack.js";
import { loadKernelPack } from "../src/kernels/kernelPack.js";

function okResponse(bytes: Uint8Array): ResponseLike {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);

  return {
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: async () => ab,
  };
}

describe("kernels.naif()", () => {
  it("defaults to NAIF generic_kernels when called with no args", () => {
    const pack = kernels.naif().pick("lsk/naif0012.tls");

    expect(pack.baseUrl).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(pack, "baseUrl")).toBe(false);
    expect(pack.kernels).toEqual([
      {
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
        path: "lsk/naif0012.tls",
      },
    ]);
  });

  it("supports partial options for origin-only and pathBase-only overrides", () => {
    const withOriginOnly = kernels
      .naif({ origin: "https://cdn.example.com/kernels" })
      .pick("lsk/naif0012.tls");

    expect(withOriginOnly.kernels).toEqual([
      {
        url: "https://cdn.example.com/kernels/lsk/naif0012.tls",
        path: "lsk/naif0012.tls",
      },
    ]);

    const withPathBaseOnly = kernels
      .naif({ pathBase: "naif" })
      .pick("lsk/naif0012.tls");

    expect(withPathBaseOnly.kernels).toEqual([
      {
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
        path: "naif/lsk/naif0012.tls",
      },
    ]);
  });

  it("builds a pack, normalizes origin/pathBase, and preserves ordering", () => {
    const ids = ["spk/planets/de432s.bsp", "lsk/naif0012.tls"] as const satisfies readonly [
      NaifKernelId,
      ...NaifKernelId[],
    ];

    const pack = kernels
      .naif({
        origin: "https://cdn.example.com/kernels",
        pathBase: "/naif",
      })
      .pick(ids);

    expect(pack.kernels).toEqual([
      {
        url: "https://cdn.example.com/kernels/spk/planets/de432s.bsp",
        path: "/naif/spk/planets/de432s.bsp",
      },
      {
        url: "https://cdn.example.com/kernels/lsk/naif0012.tls",
        path: "/naif/lsk/naif0012.tls",
      },
    ]);
  });

  it("includes pack.baseUrl when kernelUrlPrefix is relative", () => {
    const pack = kernels
      .naif({
        origin: "kernels/naif/",
        baseUrl: "/myapp/",
        pathBase: "naif/",
      })
      .pick("lsk/naif0012.tls");

    expect(pack.baseUrl).toBe("/myapp/");
    expect(pack.kernels).toEqual([
      {
        url: "kernels/naif/lsk/naif0012.tls",
        path: "naif/lsk/naif0012.tls",
      },
    ]);
  });

  it("omits pack.baseUrl when kernelUrlPrefix is absolute", () => {
    const pack = kernels
      .naif({
        origin: "https://cdn.example.com/kernels/",
        baseUrl: "https://example.com/myapp/",
        pathBase: "naif/",
      })
      .pick("lsk/naif0012.tls");

    expect(pack.baseUrl).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(pack, "baseUrl")).toBe(false);
  });

  it("throws on pick() and pick([])", () => {
    const catalog = kernels.naif({
      origin: "https://cdn.example.com/kernels/",
      pathBase: "naif/",
    });

    expect(() => (catalog.pick as unknown as () => unknown)()).toThrow(/expected at least one id\/entry/);
    expect(() => (catalog.pick as unknown as (arg: unknown) => unknown)([])).toThrow(
      /expected at least one id\/entry/,
    );
  });

  it("dedupes duplicates (preserves first-occurrence order)", () => {
    const pack = kernels
      .naif({
        origin: "https://cdn.example.com/kernels/",
        pathBase: "naif/",
      })
      .pick("lsk/naif0012.tls", "lsk/naif0012.tls", "spk/planets/de432s.bsp", "lsk/naif0012.tls");

    expect(pack.kernels.map((k) => k.path)).toEqual([
      "naif/lsk/naif0012.tls",
      "naif/spk/planets/de432s.bsp",
    ]);
  });
});

describe("kernels.tspice()", () => {
  it("defaults to the tspice-viewer hosted mirror and preserves ordering", () => {
    const pack = kernels.tspice().pick("pck/pck00011.tpc", "lsk/naif0012.tls");

    expect(pack.baseUrl).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(pack, "baseUrl")).toBe(false);
    expect(pack.kernels).toEqual([
      {
        url: "https://tspice-viewer.ryboso.me/kernels/naif/pck/pck00011.tpc",
        path: "naif/pck/pck00011.tpc",
      },
      {
        url: "https://tspice-viewer.ryboso.me/kernels/naif/lsk/naif0012.tls",
        path: "naif/lsk/naif0012.tls",
      },
    ]);
  });

  it("dedupes duplicates (preserves first-occurrence order)", () => {
    const pack = kernels
      .tspice()
      .pick("pck/pck00011.tpc", "lsk/naif0012.tls", "pck/pck00011.tpc", "lsk/naif0012.tls");

    expect(pack.kernels.map((k) => k.path)).toEqual(["naif/pck/pck00011.tpc", "naif/lsk/naif0012.tls"]);
  });
});

describe("kernels.custom()", () => {
  it("maps string ids via origin + pathBase", () => {
    const pack = kernels
      .custom({
        origin: "https://example.com/kernels/",
        pathBase: "custom/",
      })
      .pick("mission.bsp");

    expect(pack.kernels).toEqual([
      {
        url: "https://example.com/kernels/mission.bsp",
        path: "custom/mission.bsp",
      },
    ]);
  });

  it("supports url-only mode when opts are omitted", () => {
    const pack = kernels.custom().pick({ url: "https://example.com/a/de432s.bsp" });
    expect(pack.kernels).toHaveLength(1);
    expect(pack.kernels[0]?.url).toBe("https://example.com/a/de432s.bsp");
    expect(pack.kernels[0]?.path).toMatch(/^\/kernels\/[0-9a-f]{12}-de432s\.bsp$/);
  });

  it("throws when string ids are used without mapping opts", () => {
    const catalog = kernels.custom();
    expect(() => (catalog.pick as unknown as (id: unknown) => unknown)("mission.bsp")).toThrow(
      /string ids require kernels\.custom\(\{ origin, pathBase, baseUrl\? \}\)/,
    );
  });

  it("dedupes duplicates (preserves first-occurrence order)", () => {
    const pack = kernels
      .custom({
        origin: "https://example.com/kernels/",
        pathBase: "custom/",
      })
      .pick("a.tls", "b.tls", "a.tls");

    expect(pack.kernels.map((k) => k.path)).toEqual(["custom/a.tls", "custom/b.tls"]);
  });

  it("defaults kernel paths to stable hashed values to avoid collisions", () => {
    const pack = kernels
      .custom({ origin: "https://example.com/", pathBase: "custom/" })
      .pick({ url: "https://example.com/a/de432s.bsp" }, { url: "https://example.com/b/de432s.bsp" });

    const [a, b] = pack.kernels;
    expect(a?.path).toMatch(/^\/kernels\/[0-9a-f]{12}-de432s\.bsp$/);
    expect(b?.path).toMatch(/^\/kernels\/[0-9a-f]{12}-de432s\.bsp$/);
    expect(a?.path).not.toBe(b?.path);
  });

  it("includes querystring in the hash so versioned URLs do not collide", () => {
    const pack = kernels
      .custom({ origin: "https://example.com/", pathBase: "custom/" })
      .pick({ url: "https://example.com/de432s.bsp?v=1" }, { url: "https://example.com/de432s.bsp?v=2" });

    expect(pack.kernels[0]?.path).not.toBe(pack.kernels[1]?.path);
  });
});


describe("loadKernelPack()", () => {
  it("rejects legacy opts.baseUrl (moved to pack.baseUrl)", async () => {
    const fetch = vi.fn(async (_url: string) => okResponse(new Uint8Array([1]))) satisfies FetchLike;

    const spice = { kit: { loadKernel: vi.fn(async (_kernel: KernelSource) => {}) } };
    const pack: KernelPack = {
      kernels: [{ url: "a", path: "/a" }],
    };

    await expect(
      loadKernelPack(spice, pack, {
        fetch,
        // Old API: `baseUrl` used to live here.
        // This should throw a helpful migration error.
        baseUrl: "https://example.com/myapp/",
      } as unknown as never),
    ).rejects.toThrow(/opts\.baseUrl has been removed/);
  });

  it("throws when pack.baseUrl is not directory-style (missing trailing slash)", async () => {
    const fetch = vi.fn(async (_url: string) => okResponse(new Uint8Array([1]))) satisfies FetchLike;
    const spice = { kit: { loadKernel: vi.fn(async (_kernel: KernelSource) => {}) } };

    const pack: KernelPack = {
      baseUrl: "https://example.com/myapp",
      kernels: [{ url: "kernels/a.tls", path: "/kernels/a.tls" }],
    };

    await expect(loadKernelPack(spice, pack, { fetch })).rejects.toThrow(
      /absolute baseUrl must be directory-style/,
    );
  });

  it("resolves relative kernel URLs against baseUrl (directory-style)", async () => {
    const fetch = vi.fn(async (url: string) => okResponse(new Uint8Array([1]))) satisfies FetchLike;

    const loadKernel = vi.fn(async (_kernel: KernelSource) => {});
    const spice = { kit: { loadKernel } };

    const pack: KernelPack = {
      baseUrl: "https://example.com/myapp/",
      kernels: [{ url: "kernels/a.tls", path: "/kernels/a.tls" }],
    };

    await loadKernelPack(spice, pack, { fetch });

    expect(fetch).toHaveBeenCalledWith("https://example.com/myapp/kernels/a.tls");
    expect(loadKernel).toHaveBeenCalledWith({
      path: "/kernels/a.tls",
      bytes: new Uint8Array([1]),
    });
  });

  it("throws on protocol-relative baseUrl (Node fetch requires scheme-based URLs)", async () => {
    const fetch = vi.fn(async (url: string) => okResponse(new Uint8Array([1]))) satisfies FetchLike;
    const spice = { kit: { loadKernel: vi.fn(async (_kernel: KernelSource) => {}) } };

    const pack: KernelPack = {
      baseUrl: "//example.com/myapp/",
      kernels: [{ url: "kernels/a.tls", path: "/kernels/a.tls" }],
    };

    await expect(loadKernelPack(spice, pack, { fetch })).rejects.toThrow(/scheme-based URLs like \"https:\/\//);
  });

  it("supports root-relative URLs with applyBaseOrigin", async () => {
    const fetch = vi.fn(async (url: string) => okResponse(new Uint8Array([1]))) satisfies FetchLike;
    const spice = { kit: { loadKernel: vi.fn(async (_kernel: KernelSource) => {}) } };

    await loadKernelPack(
      spice,
      {
        baseUrl: "https://example.com/myapp/",
        kernels: [{ url: "/kernels/a.tls", path: "/kernels/a.tls" }],
      },
      {
        fetch,
        rootRelativeKernelUrlBehavior: "applyBaseOrigin",
      },
    );

    expect(fetch).toHaveBeenCalledWith("https://example.com/kernels/a.tls");
  });

  it("fetches sequentially by default", async () => {
    const events: string[] = [];

    const fetch: FetchLike = async (url) => {
      events.push(`fetch:${url}`);
      return okResponse(new Uint8Array([url.charCodeAt(0)]));
    };

    const spice = {
      kit: {
        loadKernel: async (kernel: KernelSource) => {
          if (typeof kernel !== "string") events.push(`load:${kernel.path}`);
        },
      },
    };

    const pack: KernelPack = {
      kernels: [
        { url: "a", path: "/a" },
        { url: "b", path: "/b" },
      ],
    };

    await loadKernelPack(spice, pack, { fetch });

    expect(events).toEqual(["fetch:a", "load:/a", "fetch:b", "load:/b"]);
  });

  it("can fetch in parallel while still loading kernels sequentially in pack order", async () => {
    const events: string[] = [];
    const pending: Array<{ url: string; resolve: (res: ResponseLike) => void }> = [];

    const fetch: FetchLike = (url) => {
      events.push(`fetch:${url}`);
      return new Promise<ResponseLike>((resolve) => {
        pending.push({ url, resolve });
      });
    };

    const spice = {
      kit: {
        loadKernel: async (kernel: KernelSource) => {
          if (typeof kernel !== "string") events.push(`load:${kernel.path}`);
        },
      },
    };

    const pack: KernelPack = {
      kernels: [
        { url: "a", path: "/a" },
        { url: "b", path: "/b" },
      ],
    };

    const p = loadKernelPack(spice, pack, { fetch, fetchStrategy: "parallel" });

    // All fetches should be kicked off before any loads happen.
    expect(pending.map((x) => x.url)).toEqual(["a", "b"]);
    expect(events).toEqual(["fetch:a", "fetch:b"]);

    // Resolve out-of-order; load order should still match pack order.
    pending[1]!.resolve(okResponse(new Uint8Array([2])));
    pending[0]!.resolve(okResponse(new Uint8Array([1])));

    await p;

    expect(events).toEqual(["fetch:a", "fetch:b", "load:/a", "load:/b"]);
  });
});
