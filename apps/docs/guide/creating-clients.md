# Creating clients

The canonical way to construct SPICE clients is the `spiceClients` builder.

It lets you:

- preload kernels
- optionally enable transport-level caching
- choose an execution mode (`toSync`, `toAsync`, or `toWebWorker`)

## The basic shape

Builder calls are chainable; the **terminal** call (`toSync()` / `toAsync()` / `toWebWorker()`) creates the backend and runs eager kernel preload.

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients.toAsync();

try {
  console.log(await spice.kit.toolkitVersion());
} finally {
  await dispose();
}
```

## Execution modes

### `toSync()` (in-process, sync-ish API)

- Returns `Spice` (methods are synchronous)
- Still async to construct: `await spiceClients.toSync(...)`

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients.toSync({ backend: "node" });

try {
  console.log(spice.raw.tkvrsn("TOOLKIT"));
} finally {
  await dispose();
}
```

### `toAsync()` (in-process, async API)

- Returns `SpiceAsync` (every method returns a `Promise`)
- Works in browsers and Node

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients.toAsync({ backend: "wasm" });

try {
  console.log(await spice.kit.toolkitVersion());
} finally {
  await dispose();
}
```

### `toWebWorker()` (browser Web Worker)

- Returns `SpiceAsync` running in a worker (WASM backend)
- Recommended for browsers so SPICE work doesn’t block the main thread

See [/guide/browser](/guide/browser).

## Kernel preload

Use `.withKernel(pack)` to eagerly fetch and load kernels before you start calling SPICE routines:

```ts
import { kernels, spiceClients } from "@rybosome/tspice";

// Vite/VitePress (browser): resolves relative kernel URLs against your app base.
const baseUrl = import.meta.env.BASE_URL;

const pack = kernels
  .naif({ baseUrl, kernelUrlPrefix: "kernels/naif/" })
  .naif0012_tls()
  .pck00011_tpc()
  .pack();

const { spice, dispose } = await spiceClients
  .withKernel(pack)
  .toAsync();

try {
  console.log(await spice.kit.toolkitVersion());
} finally {
  await dispose();
}
```

Note: in Node, `fetch()` requires absolute URLs. Either build packs with absolute `kernel.url` values (the default for `kernels.naif()`), or set an absolute `baseUrl` on the pack.

Kernels (what they are, where they come from, and hosting strategies) are covered in [/guide/kernels](/guide/kernels).

## Caching (optional)

`.caching(...)` adds an **in-memory** memoization layer to the client transport (works with `toSync()`, `toAsync()`, and `toWebWorker()`).

Notes:

- Cache is per-client and cleared on `dispose()`.
- “Identical” is determined by op name + a `JSON.stringify`-based cache key for the arguments (object key insertion order matters).
- Calls with non-JSON-friendly / binary-like arguments are treated as non-cacheable.
- Kernel mutation ops (load/unload/clear) bypass the cache; caching works best when kernels are loaded once up-front.
- Cache hits return values by reference; treat returned objects/arrays as immutable when caching is enabled.

It’s great when you do repeated queries with the same inputs (for example, UI refresh loops).

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients
  .caching({ maxEntries: 2_000 })
  .toWebWorker();

try {
  console.log(await spice.kit.toolkitVersion());
} finally {
  await dispose();
}
```

## Lifecycle: always dispose

`spiceClients.to*()` returns `{ spice, dispose }`.

- `dispose()` is **idempotent**
- `dispose()` is **best-effort** (it won’t throw)

Always clean up in a `finally` block:

```ts
const { spice, dispose } = await spiceClients.toAsync();

try {
  // ...
} finally {
  await dispose();
}
```
