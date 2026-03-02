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
> For browsers, `kernels.tspice()` provides a small CORS-enabled community mirror for quickstart/testing.
> It is **not recommended for production**.
> It is self-funded and may be rate-limited, disabled, or trimmed if hosting costs become an issue.
> For production, self-host kernels (or proxy) and use `kernels.naif({ ... })` / `kernels.custom(...)`.

```ts
import { kernels, spiceClients } from "@rybosome/tspice";

const kernelPack = kernels.tspice().pick(
  "lsk/naif0012.tls",
  "pck/pck00011.tpc",
  "spk/planets/de432s.bsp",
);

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

> Note: `KernelPack` now carries an optional `baseUrl`; set `pack.baseUrl` (instead of passing a `{ baseUrl }` options object to `spiceClients.withKernels(...)`).

### Public kernel packs

Use `kernels.tspice()` for a small, typed, zero-config kernel catalog rooted at tspice's hosted mirror (`https://tspice-viewer.ryboso.me/`).

- Intended for quickstart/testing.
- Not recommended for production.
- Returns **fixed absolute URLs** and does not accept configuration.

Use `kernels.naif()` to target the full NAIF `generic_kernels` inventory.

- IDs are leaf paths like `"lsk/naif0012.tls"`.
- By default, `origin` is `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/`.
- By default, `pathBase` is empty (`""`), so `kernel.path` matches the picked leaf id.
- Optional overrides are available via `kernels.naif({ origin?, pathBase?, baseUrl? })`.
- `origin` is a build-time URL prefix (`origin + id`), not the URL authority/origin concept.
- `baseUrl` (when set) becomes `pack.baseUrl` and is used at load time to resolve **relative** kernel URLs.

> Note: `pick(...)` preserves caller-provided ordering (no sorting / “safe load order” magic).

```ts
import { kernels, type NaifKernelId } from "@rybosome/tspice";

const NAIF_KERNEL_IDS: NaifKernelId[] = [
  "lsk/naif0012.tls",
  "pck/pck00011.tpc",
  "spk/planets/de432s.bsp",
];

const pack = kernels.naif().pick(NAIF_KERNEL_IDS);

// Self-hosting / subpath deployment example:
const selfHostedPack = kernels
  .naif({
    origin: "kernels/naif/",
    baseUrl: import.meta.env.BASE_URL,
    pathBase: "naif/",
  })
  .pick(NAIF_KERNEL_IDS);
```

### Custom kernels

`kernels.custom` has two explicit modes:

- `kernels.custom()` (no opts): URL-entry-only mode.
  - `pick(...)` accepts only explicit `{ url, path? }` entries.
- `kernels.custom({ origin, pathBase, baseUrl? })`: mapping mode.
  - String ids map to `{ url: origin + id, path: pathBase + id }`.
  - `origin` is a build-time URL prefix (`origin + id`), not the URL authority/origin concept.
  - You can still pass explicit `{ url, path? }` entries as an escape hatch.

If `path` is omitted on explicit entries, it defaults to a stable hashed path like
`/kernels/<hash>-<basename(url)>`.

```ts
import { kernels, spiceClients } from "@rybosome/tspice";

const pack = kernels
  .custom({
    origin: "kernels/custom/",
    baseUrl: import.meta.env.BASE_URL,
    pathBase: "custom/",
  })
  .pick(
    "my-kernel.bsp",
    // Escape hatch:
    { url: "https://example.com/weird/location/attitude.ck" },
  );

const { spice } = await spiceClients
  .withKernels(pack)
  .toAsync({ backend: "wasm" });
```

```ts
// URL-entry-only mode (no origin/pathBase mapping):
const urlOnlyPack = kernels.custom().pick(
  { url: "https://example.com/de440.bsp" },
  { url: "https://example.com/pck00011.tpc" },
);
```

### Batching semantics

Kernel load order matches call order:

- `withKernels(pack)` appends 1 batch
- `withKernels(packs)` appends multiple batches (**`packs` must be non-empty**)

### Migration note (breaking): `withKernels([])`

`spiceClients.withKernels([])` used to be accepted as a no-op. It is now rejected:

- TypeScript now requires a non-empty tuple for array calls.
- Runtime now throws if `[]` is passed (including untyped/JS callers).

Migration options:

- Guard dynamic arrays before calling: `if (packs.length) builder = builder.withKernels(packs);`
- Or append packs one at a time with repeated `withKernels(pack)` calls.

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

Start with the docs troubleshooting guide for common user-fixable errors (backend load, worker setup, kernel URL/path/baseUrl/fetch config, and missing required kernels):

- <https://rybosome.github.io/tspice/guide/troubleshooting>

### “Native addon tspice_backend_node.node not found” / “Failed to load tspice native backend ...”

If you selected the Node/native backend (`backend: "node"`) and you’re running from the workspace and haven’t built the addon yet:

```bash
pnpm --filter @rybosome/tspice-backend-node run build:native
```

For more details (including `TSPICE_BACKEND_NODE_BINDING_PATH`), see [`@rybosome/tspice-backend-node`](../backend-node/README.md).

## Versioning

This package is under active development and the API shape is expected to churn.
