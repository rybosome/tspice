# @rybosome/tspice

## Overview

`@rybosome/tspice` is the public facade for this repo.

The **canonical** way to construct SPICE clients is the `spiceClients` builder:

- configure caching + kernel preload
- pick an execution mode via a terminal method:
  - `toSync()` (in-process, sync-ish calls)
  - `toAsync()` (in-process, async calls)
  - `toWebWorker()` (async calls in a Web Worker)

## CSPICE / NAIF disclosure

See [`docs/cspice-naif-disclosure.md`](../../docs/cspice-naif-disclosure.md) for the canonical disclosure text, NAIF links, and pointers to notice files.

Depending on `@rybosome/tspice` will typically pull in backend packages that ship CSPICE-derived components; see each backend package `NOTICE` for details.

## Installation

### ESM-only (published package)

The published `@rybosome/tspice` package is **ESM-only** (`type: "module"`). It does not ship a CommonJS (`require()`) entrypoint.

If you're in a CommonJS project, use a dynamic import:

```js
const { kernels, spiceClients } = await import("@rybosome/tspice");
```

## Usage (Quickstart)

### Browser / WASM (async)

> Note: NAIF-hosted kernel URLs are blocked by browser CORS.
> For browsers, self-host a mirror (or proxy) and use relative `urlBase` + a `baseUrl`.

```ts
import { kernels, spiceClients } from "@rybosome/tspice";

// Mirror the NAIF files into your app's public assets, preserving subdirectories:
// - public/kernels/naif/lsk/naif0012.tls
// - public/kernels/naif/pck/pck00011.tpc
// - public/kernels/naif/spk/planets/de432s.bsp
const kernelPack = kernels
  .naif({
    urlBase: "kernels/naif/",
    // Important for apps deployed under a subpath (GitHub Pages, etc).
    baseUrl: import.meta.env.BASE_URL,
  })
  .naif0012_tls()
  .pck00011_tpc()
  .de432s_bsp()
  .pack();

const { spice, dispose } = await spiceClients
  // Optional: memoize responses at the transport/RPC layer.
  .caching({ maxEntries: 2_000 })
  // Optional: preload kernels over fetch().
  .withKernels(kernelPack)
  .toAsync({ backend: "wasm" });

try {
  const et = await spice.kit.utcToEt("2000 JAN 01 12:00:00");
  const state = await spice.kit.getState({ target: "EARTH", observer: "SUN", at: et });
  console.log(state.position, state.velocity);
} finally {
  await dispose();
}
```

### Node / native addon (sync-ish)

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients.toSync({ backend: "node" });
try {
  console.log(spice.raw.tkvrsn("TOOLKIT"));
} finally {
  await dispose();
}
```

## Kernel loading

> Note: `KernelPack` now carries an optional `baseUrl`; `spiceClients.withKernels(pack)` no longer accepts
> `{ baseUrl }`.

### Public kernel packs

Use `kernels.naif(opts?)` for a typed NAIF `generic_kernels` catalog. Call `.pack()` to get a `KernelPack`.

```ts
import { kernels } from "@rybosome/tspice";

const pack = kernels.naif().naif0012_tls().pck00011_tpc().pack();
```

`publicKernels` / `createPublicKernels` are still exported for compatibility, but new code should prefer
`kernels.naif()` / `kernels.custom()`.

### Custom kernels

Use `kernels.custom(opts?)` to build a `KernelPack` for arbitrary kernels.

If `path` is omitted, it defaults to a stable hashed path like `/kernels/<hash>-<basename(url)>` (basename query/hash stripped).

```ts
import { kernels, spiceClients } from "@rybosome/tspice";

const pack = kernels
  .custom({ baseUrl: import.meta.env.BASE_URL })
  .add({ url: "kernels/custom/my-kernel.bsp" }) // path auto-defaults
  .pack();

const { spice } = await spiceClients
  .withKernels(pack)
  .toAsync({ backend: "wasm" });
```

### Batching semantics

Kernel load order matches call order:

- `withKernels(pack)` appends 1 batch
- `withKernels(packs)` appends multiple batches
- `withKernel(...)` appends its own 1-kernel batch

## Backend notes

- Node backend (`backend: "node"`): implemented by a native addon. Requires a compatible native binding to be present.
- WASM backend (`backend: "wasm"`): implemented with a prebuilt `.wasm`. See [`@rybosome/tspice-backend-wasm`](../backend-wasm/README.md).

### Web Worker notes

`spiceClients.toWebWorker()` uses an **inline blob worker** by default (the worker
source is generated at build time and embedded into the JS bundle). This means
consumers do not need to separately bundle/host a worker entry JS file.

The worker still uses the WASM backend and must be able to fetch the `.wasm`
binary. Most bundlers handle this automatically.

If your bundler or deployment setup relocates the `.wasm` asset, pass an explicit
`wasmUrl` to `toWebWorker()`:

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients.toWebWorker({
  wasmUrl: "/assets/tspice_backend_wasm.wasm",
});

try {
  console.log(await spice.kit.toolkitVersion());
} finally {
  await dispose();
}
```

## Development

```bash
pnpm --filter @rybosome/tspice run build
pnpm --filter @rybosome/tspice run typecheck
pnpm --filter @rybosome/tspice run test
```

## Troubleshooting / FAQ

### “Native addon tspice_backend_node.node not found” / “Failed to load tspice native backend ...”

If you selected the Node/native backend (`backend: "node"`) and you’re running from the workspace and haven’t built the addon yet:

```bash
pnpm --filter @rybosome/tspice-backend-node run build:native
```

For more details (including `TSPICE_BACKEND_NODE_BINDING_PATH`), see [`@rybosome/tspice-backend-node`](../backend-node/README.md).

## Versioning

This package is under active development and the API shape is expected to churn.
