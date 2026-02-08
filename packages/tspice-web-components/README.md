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

## Roadmap

A canonical, batteries-included Web Worker client is coming soon:
https://github.com/rybosome/tspice/issues/334
