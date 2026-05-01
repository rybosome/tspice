# Kernels

SPICE “kernels” are data files that the toolkit loads into a shared kernel pool.

Examples:

- **LSK** (leapseconds): time conversions like UTC → ET
- **PCK** (planetary constants): body radii, frame definitions, etc.
- **SPK** (ephemerides): position/velocity for bodies over time

In `tspice`, you typically **fetch kernels** and **load them** during client construction.

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

## Kernel catalogs (`kernels.*`)

All built-in catalogs (`kernels.tspice()`, `kernels.naif()`, `kernels.custom(...)`) expose **one method**:

- `pick(...)` returns a `KernelPack` immediately.
- **No ordering magic:** `pick(...)` preserves caller-provided order.

This means *you* control (and are responsible for) kernel load order.

## `kernels.tspice()` (curated community mirror)

`kernels.tspice()` is a **zero-config** curated catalog intended to “just work” in **browsers + Node**.

It points at a CORS-enabled hosted mirror (`https://tspice-viewer.ryboso.me/`).

- Intended for quickstarts/demos.
- Not recommended for production.
- Best-effort / community-hosted.
- Self-funded; it may be rate-limited, disabled, or trimmed if hosting costs become an issue.

```ts
import { kernels } from "@rybosome/tspice";

const pack = kernels.tspice().pick(
  "lsk/naif0012.tls",
  "pck/pck00011.tpc",
  // add: "spk/planets/de432s.bsp" if you need ephemerides
);
```

## `kernels.naif()` + optional overrides (full typed NAIF inventory)

`kernels.naif()` targets the NAIF `generic_kernels` inventory by default.

- IDs are **leaf paths** like `"lsk/naif0012.tls"`, `"pck/pck00011.tpc"`, `"spk/planets/de432s.bsp"`, etc.
- IDs are fully typed as `NaifKernelId` (a ~450 item literal union).
- Defaults: `origin = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"`, `pathBase = ""`.
- Optional overrides: `kernels.naif({ origin?, pathBase?, baseUrl? })`.
- `origin` is a build-time URL prefix used to construct each `kernel.url` (`origin + id`).
  The name is historical API naming, not the URL authority/origin concept.
- `pathBase` is a virtual prefix for each `kernel.path` (`pathBase + id`).
- `baseUrl` becomes `pack.baseUrl` (used to resolve **relative** URLs at load time).

### Using `pick` overloads (avoid `satisfies ...` everywhere)

`pick` is overloaded so you can call it with:

- a single id: `pick("...")`
- multiple ids: `pick("...", "...")`
- a typed array: `pick(KERNEL_IDS)`

The “typed array” approach is usually the lightest for real apps:

```ts
import { kernels, type NaifKernelId } from "@rybosome/tspice";

const KERNEL_IDS: NaifKernelId[] = [
  "lsk/naif0012.tls",
  "pck/pck00011.tpc",
  "spk/planets/de432s.bsp",
];

const pack = kernels.naif().pick(KERNEL_IDS);

// Self-hosting / subpath deployment override:
const selfHostedPack = kernels
  .naif({
    origin: "kernels/naif/",
    baseUrl: import.meta.env.BASE_URL,
    pathBase: "naif/",
  })
  .pick(KERNEL_IDS);
```

### Node vs browser note

- NAIF’s canonical host does not send CORS headers, so direct browser fetches may fail.
- In Node, `fetch()` requires **absolute** URLs.

So typically:

- **Browser:** use a **relative** `origin` (served as static assets) + `baseUrl`.
- **Node:** use an **absolute** `origin` (or an absolute `baseUrl`).

Example (Node / canonical NAIF host):

```ts
import { kernels } from "@rybosome/tspice";

const pack = kernels
  .naif()
  .pick("lsk/naif0012.tls");
```

For a full inventory of NAIF `generic_kernels`, see: [/guide/kernel-inventory](/guide/kernel-inventory).

## Preloading kernels with `spiceClients`

Use `.withKernels(pack)` to preload kernels before you start calling SPICE routines:

```ts
import { kernels, spiceClients } from "@rybosome/tspice";

const baseUrl = import.meta.env.BASE_URL;

const pack = kernels
  .naif({
    origin: "kernels/naif/",
    baseUrl,
    pathBase: "naif/",
  })
  .pick("lsk/naif0012.tls", "pck/pck00011.tpc");

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

You can also pass an array: `.withKernels([packA, packB])`.
Array input must be non-empty.

## Hosting kernel files (`origin` + `baseUrl`)

Common approaches:

- **Browser apps:** copy kernels into your static assets (for example `public/kernels/naif/...`) so they’re available at `kernels/naif/...` relative to your app base.
- **Custom hosting:** use your own bucket/CDN and set an absolute `origin` like `"https://cdn.example.com/kernels/"`.

If you host your app under a base path (for example GitHub Pages), you’ll usually want to set `baseUrl` so **relative** kernel URLs resolve correctly.

`baseUrl` is a URL/path *directory* prefix:

- It can be an absolute URL (`"https://cdn.example.com/myapp/"`) or a path prefix (`"/myapp/"`, `"myapp/"`).
- It must end with a trailing `/`.
- It is only applied to **relative** `kernel.url` values.

> Note: if you use a root-relative `origin` like `"/kernels/naif/"`, the resulting kernel URLs start with `/` and will bypass `baseUrl` by default.
> For subpath hosting, prefer a relative `origin` (no leading `/`) so `baseUrl` can be applied.

## `kernels.custom(...)` modes

`kernels.custom(...)` is for mission/application-specific kernels and has two modes:

- `kernels.custom()` (no opts): URL-entry-only mode.
  - `pick(...)` accepts only explicit `{ url, path? }` entries.
- `kernels.custom({ origin, pathBase, baseUrl? })`: mapping mode.
  - String ids map to `{ url: origin + id, path: pathBase + id }`.
  - `origin` is a build-time URL prefix (`origin + id`), not URL authority/origin semantics.
  - You can still pass explicit `{ url, path? }` entries as an escape hatch.

If `path` is omitted on explicit entries, tspice derives a stable hashed virtual path.

```ts
import { kernels, spiceClients } from "@rybosome/tspice";

const baseUrl = import.meta.env.BASE_URL;

const pack = kernels
  .custom({
    origin: "kernels/custom/",
    baseUrl,
    pathBase: "custom/",
  })
  .pick(
    "mission.bsp",
    "attitude.ck",
    // escape hatch:
    { url: "https://example.com/weird/location/kernel.bsp" },
  );

const { spice, dispose } = await spiceClients
  .withKernels(pack)
  .toAsync({ backend: "wasm" });

try {
  console.log(await spice.kit.toolkitVersion());
} finally {
  await dispose();
}
```

URL-entry-only mode example:

```ts
const urlOnlyPack = kernels.custom().pick(
  { url: "https://example.com/mission.bsp" },
  { url: "https://example.com/attitude.ck" },
);
```

### Migration note (breaking): `withKernels([])`

`spiceClients.withKernels([])` used to be accepted as a no-op; it is now rejected.

- TypeScript requires a non-empty tuple for array calls.
- Runtime throws if `[]` is passed (including JS/untyped callers).

Migration pattern for dynamic arrays:

```ts
for (const pack of packs) {
  builder = builder.withKernels(pack);
}
```

If you already have a non-empty tuple, you can still call `builder = builder.withKernels(packs)`.

## Next

- Browser specifics: [/guide/browser](/guide/browser)
- Node specifics: [/guide/node](/guide/node)
