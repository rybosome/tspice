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
- always disposes the client in a `finally`

```ts
import { publicKernels, spiceClients } from "@rybosome/tspice";

const kernelPack = publicKernels
  .naif0012_tls()
  .pck00011_tpc()
  .de432s_bsp()
  .pack();

const { spice, dispose } = await spiceClients
  .withKernels(kernelPack)
  .toAsync({ backend: "wasm" });

try {
  const et = await spice.kit.utcToEt("2000 JAN 01 12:00:00");
  const state = await spice.kit.getState({
    target: "EARTH",
    observer: "SUN",
    at: et,
  });

  console.log(state.position, state.velocity);
} finally {
  await dispose();
}
```

### Kernel hosting note

`publicKernels` defaults to URLs like `kernels/naif/naif0012.tls`.

That means:

- your app needs to serve the kernel files (often from `/kernels/naif/...` relative to your app base)
- kernel URLs are just URLs; you can host them wherever you want

See [/guide/kernels](/guide/kernels) for details (including `baseUrl` and custom hosting).

## Next

- [Creating clients](/guide/creating-clients)
- [Browser (WASM + Web Worker)](/guide/browser)
- [Node (native backend)](/guide/node)
