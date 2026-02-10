import { afterEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function okResponse(bytes: Uint8Array): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: async () => toArrayBuffer(bytes),
  } as unknown as Response;
}

async function flushPromises(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe("publicKernels", () => {
  it("builds a canonical NAIF kernel pack (order-insensitive builder)", async () => {
    const { publicKernels } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const pack = publicKernels.de432s_bsp().naif0012_tls().pck00011_tpc().pack();

    expect(pack).toEqual({
      kernels: [
        {
          url: "kernels/naif/naif0012.tls",
          path: "naif/naif0012.tls",
        },
        {
          url: "kernels/naif/pck00011.tpc",
          path: "naif/pck00011.tpc",
        },
        {
          url: "kernels/naif/de432s.bsp",
          path: "naif/de432s.bsp",
        },
      ],
    });
  });

  it("supports overriding url/path bases (test hook)", async () => {
    const { createPublicKernels } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const pack = createPublicKernels({ urlBase: "/assets", pathBase: "kernels" })
      .pck00011_tpc()
      .pack();

    expect(pack).toEqual({
      kernels: [
        {
          url: "/assets/pck00011.tpc",
          path: "kernels/pck00011.tpc",
        },
      ],
    });
  });
});

describe("loadKernelPack()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches + loads sequentially by default (lower peak memory)", async () => {
    const { loadKernelPack } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const pack = {
      kernels: [
        { url: "kernels/a.tls", path: "a.tls" },
        { url: "kernels/b.bsp", path: "b.bsp" },
      ],
    };

    const fetchA = deferred<Response>();
    const fetchB = deferred<Response>();

    const fetch = vi.fn((url: string) => {
      if (url === "/base/kernels/a.tls") return fetchA.promise;
      if (url === "/base/kernels/b.bsp") return fetchB.promise;
      throw new Error(`Unexpected fetch url: ${url}`);
    });

    const load1 = deferred<void>();
    const load2 = deferred<void>();

    const loadKernel = vi
      .fn()
      .mockImplementationOnce(() => load1.promise)
      .mockImplementationOnce(() => load2.promise);

    const spice = {
      kit: {
        loadKernel,
      },
    };

    const p = loadKernelPack(spice, pack, { baseUrl: "/base", fetch });

    // Only the first fetch should start.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(loadKernel).toHaveBeenCalledTimes(0);

    // Once the first fetch resolves, the first load should start.
    fetchA.resolve(okResponse(new Uint8Array([1])));
    await flushPromises();

    expect(loadKernel).toHaveBeenCalledTimes(1);
    expect(loadKernel).toHaveBeenNthCalledWith(1, {
      path: "a.tls",
      bytes: new Uint8Array([1]),
    });

    // Second fetch should not start until the first load resolves.
    expect(fetch).toHaveBeenCalledTimes(1);

    load1.resolve(undefined);
    await flushPromises();

    // Now the second fetch starts.
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(loadKernel).toHaveBeenCalledTimes(1);

    fetchB.resolve(okResponse(new Uint8Array([2])));
    await flushPromises();

    expect(loadKernel).toHaveBeenCalledTimes(2);
    expect(loadKernel).toHaveBeenNthCalledWith(2, {
      path: "b.bsp",
      bytes: new Uint8Array([2]),
    });

    load2.resolve(undefined);
    await expect(p).resolves.toBeUndefined();
  });

  it("fetches in parallel (opt-in) and loads sequentially in pack order", async () => {
    const { loadKernelPack } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const pack = {
      kernels: [
        { url: "kernels/a.tls", path: "a.tls" },
        { url: "kernels/b.bsp", path: "b.bsp" },
      ],
    };

    const fetchA = deferred<Response>();
    const fetchB = deferred<Response>();

    const fetch = vi.fn((url: string) => {
      if (url === "/base/kernels/a.tls") return fetchA.promise;
      if (url === "/base/kernels/b.bsp") return fetchB.promise;
      throw new Error(`Unexpected fetch url: ${url}`);
    });

    const load1 = deferred<void>();
    const load2 = deferred<void>();

    const loadKernel = vi
      .fn()
      .mockImplementationOnce(() => load1.promise)
      .mockImplementationOnce(() => load2.promise);

    const spice = {
      kit: {
        loadKernel,
      },
    };

    const p = loadKernelPack(spice, pack, { baseUrl: "/base", fetch, fetchStrategy: "parallel" });

    // Both fetches should start before any loads.
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(loadKernel).toHaveBeenCalledTimes(0);

    // Resolving only one fetch should not start loads (Promise.all barrier).
    fetchA.resolve(okResponse(new Uint8Array([1])));
    await flushPromises();
    expect(loadKernel).toHaveBeenCalledTimes(0);

    // Once all fetches resolve, the first load should start.
    fetchB.resolve(okResponse(new Uint8Array([2])));
    await flushPromises();

    expect(loadKernel).toHaveBeenCalledTimes(1);
    expect(loadKernel).toHaveBeenNthCalledWith(1, {
      path: "a.tls",
      bytes: new Uint8Array([1]),
    });

    // Second load should not start until the first resolves.
    load1.resolve(undefined);
    await flushPromises();

    expect(loadKernel).toHaveBeenCalledTimes(2);
    expect(loadKernel).toHaveBeenNthCalledWith(2, {
      path: "b.bsp",
      bytes: new Uint8Array([2]),
    });

    load2.resolve(undefined);
    await expect(p).resolves.toBeUndefined();
  });

  it("normalizes dot segments for path-absolute baseUrl", async () => {
    const { loadKernelPack } = await import(/* @vite-ignore */ "@rybosome/tspice-web-components");

    const pack = {
      kernels: [{ url: "../kernels/a.tls?x=1#hash", path: "a.tls" }],
    };

    const fetch = vi.fn((url: string) => {
      if (url !== "/kernels/a.tls?x=1#hash") throw new Error(`Unexpected fetch url: ${url}`);
      return Promise.resolve(okResponse(new Uint8Array([1])));
    });

    const loadKernel = vi.fn().mockResolvedValue(undefined);
    const spice = {
      kit: {
        loadKernel,
      },
    };

    await loadKernelPack(spice, pack, { baseUrl: "/myapp/", fetch });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(loadKernel).toHaveBeenCalledTimes(1);
    expect(loadKernel).toHaveBeenCalledWith({
      path: "a.tls",
      bytes: new Uint8Array([1]),
    });
  });
});
