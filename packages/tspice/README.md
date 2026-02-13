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
const { spiceClients, publicKernels } = await import("@rybosome/tspice");
```

## Usage (Quickstart)

### Browser / WASM (async)

```ts
import { publicKernels, spiceClients } from "@rybosome/tspice";

const kernelPack = publicKernels
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

### Public kernel packs

`publicKernels` is a small builder for common NAIF kernels. Call `.pack()` to get a `KernelPack`.

```ts
import { publicKernels } from "@rybosome/tspice";

const pack = publicKernels.naif0012_tls().pck00011_tpc().pack();
```

### Custom kernels

Use `.withKernel({ url, path? })` to load an arbitrary kernel from a URL.

- If `path` is omitted, it defaults to `/kernels/<basename(url)>` (query/hash stripped).
- Each `.withKernel(...)` call appends its own 1-kernel batch.

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice } = await spiceClients
  .withKernel({ url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls" })
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
