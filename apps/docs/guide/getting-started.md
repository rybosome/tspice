# Getting started

`tspice` is an ESM-only TypeScript wrapper around the NAIF SPICE toolkit.

This guide uses the canonical `spiceClients` builder API.

## Install

```bash
pnpm add @rybosome/tspice
# or: npm i @rybosome/tspice
```

> `@rybosome/tspice` is **ESM-only**. In CommonJS, use `await import("@rybosome/tspice")`.

## Quickstart (portable WASM)

This snippet:

- uses the WASM backend (works in browsers and Node)
- preloads a small NAIF kernel pack
- uses an absolute kernel `baseUrl` (required for Node's `fetch()`)
- always disposes the client in a `finally`

```ts
import { kernels, spiceClients } from "@rybosome/tspice";

const baseUrl = "https://orrery.ryboso.me/";

const kernelPack = kernels
  .naif({ baseUrl, kernelUrlPrefix: "kernels/naif/" })
  .naif0012_tls()
  .pck00011_tpc()
  .pack();

const { spice, dispose } = await spiceClients
  .withKernels(kernelPack)
  .toAsync({ backend: "wasm" });

try {
  const et = await spice.kit.utcToEt("2000 JAN 01 12:00:00");
  const j2000ToEarthFixed = await spice.kit.frameTransform("J2000", "IAU_EARTH", et);

  console.log(et, j2000ToEarthFixed.toRowMajor());
} finally {
  await dispose();
}
```

### Kernel hosting note

`kernels.naif({ baseUrl, kernelUrlPrefix })` can build packs with **relative** URLs like `kernels/naif/lsk/naif0012.tls`.

That means:

- in browsers, you typically serve the kernel files as static assets (often from `/kernels/naif/...` relative to your app base)
- in Node, `fetch()` requires absolute URLs, so you must pass an **absolute** `baseUrl` (or use absolute `kernel.url` values)
- kernel URLs are just URLs; you can host them wherever you want

This quickstart uses `https://orrery.ryboso.me/` as a convenient public host for the NAIF kernels.

See [/guide/kernels](/guide/kernels) for details (including `baseUrl` and custom hosting).

## Next

- [Creating clients](/guide/creating-clients)
- [Browser (WASM + Web Worker)](/guide/browser)
- [Node (native backend)](/guide/node)
