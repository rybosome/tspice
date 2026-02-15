import { describe, expect, it, vi } from "vitest";

import type { KernelSource } from "@rybosome/tspice-backend-contract";

import { kernels } from "../src/kernels/kernels.js";
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
  it("builds a stable ordered pack and normalizes base paths", () => {
    const pack = kernels
      .naif({
        kernelUrlPrefix: "https://cdn.example.com/kernels",
        pathBase: "/naif",
      })
      .de432s_bsp()
      .naif0012_tls()
      .pack();

    expect(pack.kernels).toEqual([
      {
        url: "https://cdn.example.com/kernels/lsk/naif0012.tls",
        path: "/naif/lsk/naif0012.tls",
      },
      {
        url: "https://cdn.example.com/kernels/spk/planets/de432s.bsp",
        path: "/naif/spk/planets/de432s.bsp",
      },
    ]);
  });

  it("treats whitespace kernelUrlPrefix/pathBase as omitted (falls back to defaults)", () => {
    const pack = kernels
      .naif({
        kernelUrlPrefix: "   ",
        pathBase: "   ",
      })
      .naif0012_tls()
      .pack();

    expect(pack.kernels).toEqual([
      {
        url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
        path: "naif/lsk/naif0012.tls",
      },
    ]);
  });

  it("includes pack.baseUrl when kernelUrlPrefix is relative", () => {
    const pack = kernels
      .naif({
        kernelUrlPrefix: "kernels/naif/",
        baseUrl: "/myapp/",
      })
      .naif0012_tls()
      .pack();

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
        kernelUrlPrefix: "https://cdn.example.com/kernels/",
        baseUrl: "https://example.com/myapp/",
      })
      .naif0012_tls()
      .pack();

    expect(pack.baseUrl).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(pack, "baseUrl")).toBe(false);
  });
});

describe("kernels.custom()", () => {
  it("defaults kernel paths to stable hashed values to avoid collisions", () => {
    const pack = kernels
      .custom()
      .add({ url: "https://example.com/a/de432s.bsp" })
      .add({ url: "https://example.com/b/de432s.bsp" })
      .pack();

    const [a, b] = pack.kernels;
    expect(a?.path).toMatch(/^\/kernels\/[0-9a-f]{12}-de432s\.bsp$/);
    expect(b?.path).toMatch(/^\/kernels\/[0-9a-f]{12}-de432s\.bsp$/);
    expect(a?.path).not.toBe(b?.path);
  });

  it("includes querystring in the hash so versioned URLs do not collide", () => {
    const pack = kernels
      .custom()
      .add({ url: "https://example.com/de432s.bsp?v=1" })
      .add({ url: "https://example.com/de432s.bsp?v=2" })
      .pack();

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

  it("supports protocol-relative baseUrl", async () => {
    const fetch = vi.fn(async (url: string) => okResponse(new Uint8Array([1]))) satisfies FetchLike;
    const spice = { kit: { loadKernel: vi.fn(async (_kernel: KernelSource) => {}) } };

    const pack: KernelPack = {
      baseUrl: "//example.com/myapp/",
      kernels: [{ url: "kernels/a.tls", path: "/kernels/a.tls" }],
    };

    await loadKernelPack(spice, pack, { fetch });
    expect(fetch).toHaveBeenCalledWith("//example.com/myapp/kernels/a.tls");
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
