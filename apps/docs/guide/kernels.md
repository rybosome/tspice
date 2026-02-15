# Kernels

SPICE “kernels” are data files that the toolkit loads into a shared kernel pool.

Examples:

- **LSK** (leapseconds): time conversions like UTC → ET
- **PCK** (planetary constants): body radii, frame definitions, etc.
- **SPK** (ephemerides): position/velocity for bodies over time

In `tspice`, you typically fetch kernel bytes and load them during client construction.

## Kernel packs

`tspice` uses a simple `KernelPack` structure:

- `url`: where to fetch bytes from
- `path`: a *virtual* identifier used when loading into tspice
- `baseUrl` (optional): base URL/path prefix used to resolve **relative** `kernel.url` values

A pack is just:

```ts
type KernelPack = {
  baseUrl?: string;
  kernels: readonly { url: string; path: string }[];
};
```

## `kernels.naif()` (common NAIF kernels)

`kernels.naif()` is a small builder for the NAIF `generic_kernels` catalog, with a safe default load order.

```ts
import { kernels } from "@rybosome/tspice";

const pack = kernels
  .naif()
  .naif0012_tls()
  .pck00011_tpc()
  .de432s_bsp()
  .pack();
```

You can override URL/path behavior via `kernels.naif({ kernelUrlPrefix, baseUrl, pathBase })`.

Note: `de432s_bsp()` is relatively large and can noticeably impact download time; consider omitting it when you only need time/constants.

## Preloading kernels with `spiceClients`

Use `.withKernels(pack)` to preload kernels before you start calling SPICE routines:

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
  .withKernels(pack)
  .toAsync();

try {
  const et = await spice.kit.utcToEt("2000 JAN 01 12:00:00");
  console.log(et);
} finally {
  await dispose();
}
```

## Hosting kernel files

By default, `kernels.naif()` uses the NAIF `generic_kernels` host (URLs like `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls`).

Note: NAIF's host does not currently send CORS headers (`Access-Control-Allow-Origin`), so direct browser fetches may fail; for browsers, self-host (static assets) or use a CORS-enabled mirror.

Common approaches:

- **Browser apps**: copy kernels into your static assets (for example `public/kernels/naif/...`) so they’re available at `/kernels/naif/...` (relative to your app base).
- **Custom hosting**: use your own bucket/CDN and provide absolute URLs.

If you host your app under a base path (for example GitHub Pages), you’ll usually want to set `baseUrl` so **relative** kernel URLs resolve correctly:

```ts
import { kernels, spiceClients } from "@rybosome/tspice";

const pack = kernels
  .naif({ kernelUrlPrefix: "kernels/naif/", baseUrl: import.meta.env.BASE_URL })
  .naif0012_tls()
  .pck00011_tpc()
  .pack();

const { spice, dispose } = await spiceClients
  .withKernels(pack)
  .toAsync();

try {
  // ...
} finally {
  await dispose();
}
```

`baseUrl` is a URL/path *prefix* (a directory, not a page):

- It can be an absolute URL (`"https://cdn.example.com/myapp/"`) or a path prefix (`"/myapp/"`, `"myapp/"`).
- It must end with a trailing `/` (directory-style), so URL joining is copy/paste safe.
- It is only applied to **relative** `kernel.url` values (like `"kernels/naif/lsk/naif0012.tls"`).
- Absolute URLs are left as-is.
- In Node, `fetch()` requires absolute URLs, so you’ll typically use an absolute `baseUrl` (like `"https://…/"`) unless you pass a custom `fetch`.

Example resolution:

- `baseUrl: "/myapp/"` + `kernel.url: "kernels/naif/lsk/naif0012.tls"` → `"/myapp/kernels/naif/lsk/naif0012.tls"`

(If you’re not using Vite, pass your app’s base path directly, like `"/myapp/"` — including the trailing slash.)

## Custom kernels

To load an arbitrary kernel URL, build a pack via `kernels.custom()` and pass it to `.withKernels(pack)`.

- If `path` is omitted, tspice derives a stable virtual path from the URL (includes a short hash).

```ts
import { kernels, spiceClients } from "@rybosome/tspice";

const pack = kernels
  .custom()
  .add({
    url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
  })
  .pack();

const { spice, dispose } = await spiceClients
  .withKernels(pack)
  .toAsync({ backend: "wasm" });

try {
  console.log(await spice.kit.toolkitVersion());
} finally {
  await dispose();
}
```

## Next

- Browser specifics: [/guide/browser](/guide/browser)
- Node specifics: [/guide/node](/guide/node)
