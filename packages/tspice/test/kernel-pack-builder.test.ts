import { describe, expect, it, vi } from "vitest";

import type { KernelSource } from "@rybosome/tspice-backend-contract";

import { createPublicKernels } from "../src/kernels/publicKernels.js";
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

describe("publicKernels", () => {
  it("builds a stable ordered pack and normalizes base paths", () => {
    const pack = createPublicKernels({
      urlBase: "https://cdn.example.com/kernels",
      pathBase: "/naif",
    })
      .de432s_bsp()
      .naif0012_tls()
      .pack();

    expect(pack.kernels).toEqual([
      {
        url: "https://cdn.example.com/kernels/naif0012.tls",
        path: "/naif/naif0012.tls",
      },
      {
        url: "https://cdn.example.com/kernels/de432s.bsp",
        path: "/naif/de432s.bsp",
      },
    ]);
  });
});

describe("loadKernelPack()", () => {
  it("resolves relative kernel URLs against baseUrl (directory-style)", async () => {
    const fetch = vi.fn(async (url: string) => okResponse(new Uint8Array([1]))) satisfies FetchLike;

    const loadKernel = vi.fn(async (_kernel: KernelSource) => {});
    const spice = { kit: { loadKernel } };

    const pack: KernelPack = {
      kernels: [{ url: "kernels/a.tls", path: "/kernels/a.tls" }],
    };

    await loadKernelPack(spice, pack, {
      fetch,
      baseUrl: "https://example.com/myapp/",
    });

    expect(fetch).toHaveBeenCalledWith("https://example.com/myapp/kernels/a.tls");
    expect(loadKernel).toHaveBeenCalledWith({
      path: "/kernels/a.tls",
      bytes: new Uint8Array([1]),
    });
  });

  it("supports root-relative URLs with applyBaseOrigin", async () => {
    const fetch = vi.fn(async (url: string) => okResponse(new Uint8Array([1]))) satisfies FetchLike;
    const spice = { kit: { loadKernel: vi.fn(async (_kernel: KernelSource) => {}) } };

    await loadKernelPack(
      spice,
      { kernels: [{ url: "/kernels/a.tls", path: "/kernels/a.tls" }] },
      {
        fetch,
        baseUrl: "https://example.com/myapp/",
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
