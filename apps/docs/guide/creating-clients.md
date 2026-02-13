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

Use `.withKernels(pack)` to eagerly fetch and load kernels before you start calling SPICE routines:

```ts
import { publicKernels, spiceClients } from "@rybosome/tspice";

const pack = publicKernels.naif0012_tls().pck00011_tpc().pack();

const { spice, dispose } = await spiceClients.withKernels(pack).toAsync();

try {
  console.log(await spice.kit.toolkitVersion());
} finally {
  await dispose();
}
```

Kernels (what they are, where they come from, and hosting strategies) are covered in [/guide/kernels](/guide/kernels).

## Caching (optional)

`.caching(...)` memoizes identical transport/RPC calls.

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
