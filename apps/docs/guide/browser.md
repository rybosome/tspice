# Browser (WASM + Web Worker)

In the browser, you’ll typically use the WASM backend.

For real UIs, prefer `spiceClients.toWebWorker()`; `spiceClients.toAsync({ backend: "wasm" })` is OK for demos or small, infrequent calls.

You have two main options:

- `spiceClients.toWebWorker()`: runs SPICE calls in a Web Worker (recommended)
- `spiceClients.toAsync({ backend: "wasm" })`: simplest, runs on the main thread

## Recommended: `toWebWorker()`

`toWebWorker()` returns the async client type (`SpiceAsync`) but moves the backend into a worker so heavy SPICE calls don’t block rendering.

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
  .toWebWorker();

try {
  console.log(await spice.kit.toolkitVersion());
} finally {
  await dispose();
}
```

## WASM asset URL (`wasmUrl`)

By default, `toWebWorker()` uses an **inline blob worker**. The worker still needs to fetch the `.wasm` binary.

Most bundlers handle this automatically.

If your deployment moves the WASM asset, pass `wasmUrl`:

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

## Next

- Kernel details: [/guide/kernels](/guide/kernels)
- Client builder & lifecycle: [/guide/creating-clients](/guide/creating-clients)
