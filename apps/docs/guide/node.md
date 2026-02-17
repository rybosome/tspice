# Node (native backend)

In Node, you can choose between:

- **Native backend** (`backend: "node"`): fastest, uses a native addon
- **WASM backend** (`backend: "wasm"`): portable, no native build

## Native backend (recommended for performance)

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients.toSync({ backend: "node" });

try {
  console.log(spice.raw.tkvrsn("TOOLKIT"));
} finally {
  await dispose();
}
```

If you see errors about missing native bindings, see the backend package docs:

- `@rybosome/tspice-backend-node`

## Loading kernels from the filesystem

With the native backend, kernels can be loaded directly from absolute filesystem paths (no URL hosting required):

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients.toSync({ backend: "node" });

try {
  spice.kit.loadKernel("/abs/path/to/naif0012.tls");
  // Or the low-level equivalent:
  spice.raw.furnsh("/abs/path/to/pck00011.tpc");
} finally {
  await dispose();
}
```

Kernel preloading via `.withKernels(pack)` fetches bytes via `fetch`, so it’s best when kernels are hosted at URLs.

## WASM backend

If you don’t want native addons, the WASM backend works in Node too:

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients.toAsync({ backend: "wasm" });

try {
  console.log(await spice.kit.toolkitVersion());
} finally {
  await dispose();
}
```

## Notes

- `@rybosome/tspice` is **ESM-only**. In CommonJS, use `await import("@rybosome/tspice")`.
- Kernel preload via `.withKernels(pack)` fetches bytes via `fetch` (best for URL-hosted kernels). Node 18+ has `fetch` built in. In Node, `fetch()` requires absolute URLs (either use absolute `kernel.url` values, or set `pack.baseUrl` to an absolute URL like `https://…/`).
