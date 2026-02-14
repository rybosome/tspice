# Browser ephemeris (WASM + Web Worker)

This recipe shows a browser-first setup that:

- runs the **WASM backend** inside a **Web Worker** (`spiceClients…toWebWorker()`),
- fetches kernel bytes over HTTP,
- computes a concrete ephemeris result via `kit.getState()`.

If you want a full reference implementation, see the Orrery app:

- `apps/orrery/src/spice/createSpiceClient.ts`

## Kernels required (and why)

For basic planet-to-planet state vectors you typically need:

- **LSK** (`naif0012.tls`): leap seconds; required for `kit.utcToEt()` / `kit.etToUtc()`.
- **SPK** (`de432s.bsp` or similar): ephemerides; required for `kit.getState()` / `raw.spkezr()`.
- **PCK** (`pck00011.tpc`): body radii + orientation models; required once you start working in
  body-fixed frames (and used by many geometry/lighting routines).

The `kernels.naif()` helper builds a small “starter pack” with exactly these three kernels.

## Create a worker-backed client (recommended)

Put the kernel files at:

- `public/kernels/naif/lsk/naif0012.tls`
- `public/kernels/naif/pck/pck00011.tpc`
- `public/kernels/naif/spk/planets/de432s.bsp`

Then you can load them with `kernels.naif` + `spiceClients.withKernels()`:

```ts
import { kernels, spiceClients } from '@rybosome/tspice'

const pack = kernels
  .naif({
    kernelUrlPrefix: 'kernels/naif/',
    // Important for apps deployed under a subpath (GitHub Pages, etc).
    baseUrl: import.meta.env.BASE_URL,
  })
  .naif0012_tls()
  .pck00011_tpc()
  .de432s_bsp()
  .pack()

const { spice, dispose } = await spiceClients
  .caching({
    maxEntries: 10_000,
    ttlMs: null,
  })
  .withKernels(pack)
  .toWebWorker()

try {
  // …use `spice` (see below)…
} finally {
  await dispose()
}
```

### Alternative (no worker)

If you don’t want a worker, you can run WASM in-process:

```ts
import { createSpiceAsync } from '@rybosome/tspice'

const spice = await createSpiceAsync({ backend: 'wasm' })
```

## Explicit kernel loading as bytes (`{ path, bytes }`)

Whether you’re using a worker-backed client or an in-process WASM client, the browser-side kernel
loading primitive is:

```ts
await spice.kit.loadKernel({ path, bytes })
```

Here’s the explicit fetch + load flow (equivalent to what `withKernels()` does internally):

> Note on root-relative URLs (`"/..."`): by default, `rootRelativeKernelUrlBehavior: "bypassBaseUrl"`
> means `/...` kernel URLs **ignore** `pack.baseUrl` (so `/kernels/a.tls` stays `/kernels/a.tls`).
> This can surprise subpath deployments (`/myapp/`), where you likely want **relative** kernel URLs
> (`kernels/...`) so `pack.baseUrl` can be applied, or set `rootRelativeKernelUrlBehavior: "error"`
> to catch accidental `/...` URLs.

```ts
import { kernels, resolveKernelUrl } from '@rybosome/tspice'

const pack = kernels
  .naif({
    kernelUrlPrefix: 'kernels/naif/',
    baseUrl: import.meta.env.BASE_URL,
  })
  .naif0012_tls()
  .pck00011_tpc()
  .de432s_bsp()
  .pack()

const rootRelativeKernelUrlBehavior = 'bypassBaseUrl' as const

for (const kernel of pack.kernels) {
  const url = resolveKernelUrl(kernel.url, pack.baseUrl, rootRelativeKernelUrlBehavior)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch kernel: ${url} (${res.status} ${res.statusText})`)
  }

  const bytes = new Uint8Array(await res.arrayBuffer())
  await spice.kit.loadKernel({ path: kernel.path, bytes })
}
```

## Example: Mars state relative to Earth at a UTC

```ts
const at = await spice.kit.utcToEt('2024-01-01T00:00:00Z')

const state = await spice.kit.getState({
  target: 'MARS',
  observer: 'EARTH',
  at,
  frame: 'J2000',
  aberration: 'NONE',
})

console.log({
  positionKm: state.position,
  velocityKmPerSec: state.velocity,
  lightTimeSec: state.lightTime,
})
```

## Interpreting the result

- **Frame:** `J2000` is the canonical inertial frame.
- **Units:** `position` is **km** and `velocity` is **km/s** (this matches CSPICE `spkezr`).
- **Time:** the `at` argument and the returned `state.et` are **ET seconds past J2000**.
  Use `kit.utcToEt()` and `kit.etToUtc()` to convert to/from UTC.
