# `@rybosome/tspice-web-components`

Composable browser-side client utilities for `@rybosome/tspice`.

This package is currently intended for **internal workspace use**.

## Exports

- `SpiceTransport` — minimal transport interface (`request(op, args)`).
- `createSpiceAsyncFromTransport()` — builds a `SpiceAsync` `{ raw, kit }` client from a transport.
- `createWorkerTransport()` — request/response RPC over `Worker.postMessage()` (timeout + dispose support).
  - Types: `WorkerTransport`, `WorkerTransportRequestOptions`
- `exposeTransportToWorker()` — worker-side helper that serves a `SpiceTransport` over the same RPC protocol.
- `createSpiceWorker()` — spawns the built-in tspice Web Worker entry.
- `createSpiceWorkerClient()` — batteries-included Worker + transport + `SpiceAsync` client.
  - Type: `SpiceWorkerClient`
- `withCaching()` — memoized transport wrapper (in-flight dedupe + LRU + optional TTL).
  - When caching is disabled (e.g. `ttlMs <= 0` or `maxEntries <= 0`), returns the input transport unchanged.
  - Use `isCachingTransport()` to narrow before calling `clear()`/`dispose()`.
  - Types: `CachingTransport`, `WithCachingResult`
- `defaultSpiceCacheKey()` — default cache key generator used by `withCaching()`.
  - For plain objects, cache key stability/hit rate depends on object key insertion order (because it uses `JSON.stringify`).
- `loadKernelPack()` — fetch a kernel pack and load kernels into tspice.
  - Types: `KernelPack`, `KernelPackKernel`, `LoadKernelPackOptions`
- `publicKernels` / `createPublicKernels()` — helpers for working with a curated set of public kernel IDs.
  - Types: `CreatePublicKernelsOptions`, `PublicKernelId`, `PublicKernelsBuilder`

### `createWorkerTransport()`: `terminateOnDispose`

`dispose()` always removes listeners and rejects any pending requests.
Whether it also calls `worker.terminate()` depends on how you provide the worker:

- `worker: () => Worker` (factory) ⇒ `terminateOnDispose` defaults to `true` (transport owns the worker)
- `worker: Worker` (shared instance) ⇒ `terminateOnDispose` defaults to `false` (caller owns the worker)

Set `terminateOnDispose` explicitly to override these defaults.

Example:

```ts
import { createWorkerTransport } from "@rybosome/tspice-web-components";

// Owned worker (terminateOnDispose defaults to true)
const ownedTransport = createWorkerTransport({
  worker: () => new Worker(new URL("./tspice.worker.js", import.meta.url), { type: "module" }),
});

// Shared worker (terminateOnDispose defaults to false)
const sharedWorker = new Worker(new URL("./tspice.worker.js", import.meta.url), { type: "module" });
const sharedTransport = createWorkerTransport({ worker: sharedWorker });

ownedTransport.dispose(); // rejects pending + terminates worker
sharedTransport.dispose(); // rejects pending only (does not terminate sharedWorker)
```

### `createWorkerTransport()`: `signalDispose`

`dispose()` can optionally post `{ type: "tspice:dispose" }` to the worker.

This is a **global server cleanup signal**, so it should generally not be enabled for shared workers unless cleanup is externally coordinated.

Defaults to `signalDispose = terminateOnDispose`.

## Canonical Web Worker client

```ts
import { createSpiceWorkerClient, withCaching } from "@rybosome/tspice-web-components";

const { spice, dispose } = createSpiceWorkerClient({
  wrapTransport: (t) => withCaching(t, { maxEntries: 1000, ttlMs: 5_000 }),
  // Optional: observe wrapper/transport cleanup errors when using fire-and-forget `dispose()`.
  onDisposeError: (err) => console.error("tspice worker dispose failed", err),
});

const et = await spice.kit.utcToEt("2026-01-01T00:00:00Z");
console.log(et);

dispose();
```

`dispose()` is fire-and-forget; call `disposeAsync()` if you want to await cleanup and handle errors directly.

The built-in worker entry initializes tspice with `createSpiceAsync({ backend: "wasm" })`.
