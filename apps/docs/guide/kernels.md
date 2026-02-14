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

A pack is just:

```ts
type KernelPack = {
  kernels: readonly { url: string; path: string }[];
};
```

## `publicKernels` (common NAIF kernels)

`publicKernels` is a small builder for a few common NAIF kernels, with a safe default load order.

```ts
import { publicKernels } from "@rybosome/tspice";

const pack = publicKernels
  .naif0012_tls()
  .pck00011_tpc()
  .de432s_bsp()
  .pack();
```

Note: `publicKernels.de432s_bsp()` is relatively large and can noticeably impact download time; consider omitting it when you only need time/constants.

## Preloading kernels with `spiceClients`

Use `.withKernels(pack, { baseUrl })` to preload kernels before you start calling SPICE routines (see `baseUrl` below):

```ts
import { publicKernels, spiceClients } from "@rybosome/tspice";

const pack = publicKernels.naif0012_tls().pck00011_tpc().pack();

// Vite/VitePress (browser): resolves relative kernel URLs against your app base.
const baseUrl = import.meta.env.BASE_URL;

const { spice, dispose } = await spiceClients
  .withKernels(pack, { baseUrl })
  .toAsync();

try {
  const et = await spice.kit.utcToEt("2000 JAN 01 12:00:00");
  console.log(et);
} finally {
  await dispose();
}
```

## Hosting kernel files

By default, `publicKernels` uses URLs like `kernels/naif/naif0012.tls`.

Common approaches:

- **Browser apps**: copy kernels into your static assets (for example `public/kernels/naif/...`) so they’re available at `/kernels/naif/...` (relative to your app base).
- **Custom hosting**: use your own bucket/CDN and provide absolute URLs.

If you host your app under a base path (for example GitHub Pages), you’ll usually want to set `baseUrl` so **relative** kernel URLs resolve correctly:

```ts
const { spice, dispose } = await spiceClients
  .withKernels(pack, { baseUrl: import.meta.env.BASE_URL })
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
- It is only applied to **relative** `kernel.url` values (like `"kernels/naif/naif0012.tls"`).
- Absolute URLs are left as-is.
- In Node, `fetch()` requires absolute URLs, so you’ll typically use an absolute `baseUrl` (like `"https://…/"`) unless you pass a custom `fetch`.

Example resolution:

- `baseUrl: "/myapp/"` + `kernel.url: "kernels/naif/naif0012.tls"` → `"/myapp/kernels/naif/naif0012.tls"`

(If you’re not using Vite, pass your app’s base path directly, like `"/myapp/"` — including the trailing slash.)

## Custom kernels

To load an arbitrary kernel URL, use `.withKernel({ url, path? })`.

- If `path` is omitted, it defaults to `/kernels/<basename(url)>` (query/hash stripped).

```ts
import { spiceClients } from "@rybosome/tspice";

const { spice, dispose } = await spiceClients
  .withKernel({
    url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
  })
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
