# `@rybosome/tspice-web-components`

Composable browser-side client utilities for `@rybosome/tspice`.

This package is currently intended for **internal workspace use**.

## Exports

- `SpiceTransport` — minimal transport interface (`request(op, args)`).
- `createSpiceAsyncFromTransport()` — builds a `SpiceAsync` `{ raw, kit }` client from a transport.
- `createWorkerTransport()` — request/response RPC over `Worker.postMessage()` (timeout + dispose support).
  - Types: `WorkerTransport`, `WorkerTransportRequestOptions`
- `withCaching()` — memoized transport wrapper (in-flight dedupe + LRU + optional TTL).
  - Type: `CachingTransport`

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

## Roadmap

A canonical, batteries-included Web Worker client is coming soon:
https://github.com/rybosome/tspice/issues/334
