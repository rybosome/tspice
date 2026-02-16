# tspice

TypeScript-first access to NAIF SPICE geometry — in **Node.js** and the **browser** (via WebAssembly).

- **Docs:** https://rybosome.github.io/tspice
- **Live demo (WebGL + WASM):** https://orrery.ryboso.me/

`tspice` is a set of TypeScript packages that let you load SPICE kernels and run common SPICE workflows (time conversions, ephemerides, frames, geometry) from modern JS runtimes.

**What it is not:** a mirror of CSPICE. `tspice` embeds CSPICE-derived components behind a TypeScript API; if you need CSPICE itself as a general-purpose toolkit, download it directly from NAIF.

## Why `tspice` (vs CSPICE / SpiceyPy / …)

- **CSPICE** is the official, battle-tested toolkit from NAIF. It’s the right choice if you’re happy living in C/C++/Fortran or writing/maintaining your own bindings.
- **SpiceyPy** is an excellent Python wrapper around CSPICE. It’s great for Python-first analysis workflows.
- **`tspice`** targets a different niche: **TypeScript-first**, **browser-capable**, and designed for app-style workloads (interactive visualization, UI tooling, Web Workers).

If your target runtime is a browser, or your application is already TypeScript/Node and you want a first-class TS API, `tspice` is aimed at that gap.

## Quickstart (WASM in the browser)

> The published `@rybosome/tspice` package is **ESM-only**.

```bash
pnpm add @rybosome/tspice
# or: npm i @rybosome/tspice
```

```ts
import { kernels, spiceClients } from "@rybosome/tspice";

// A small, CORS-enabled catalog hosted for quickstart/testing.
// Not recommended for production (see notes below).
const kernelPack = kernels.tspice().pick(
  "lsk/naif0012.tls",
  "pck/pck00011.tpc",
  "spk/planets/de432s.bsp",
);

const { spice, dispose } = await spiceClients
  .withKernels(kernelPack) // fetches + stages bytes before loading
  .toAsync({ backend: "wasm" });

try {
  const et = await spice.kit.utcToEt("2000 JAN 01 12:00:00");
  const state = await spice.kit.getState({ target: "EARTH", observer: "SUN", at: et });
  console.log(state.position, state.velocity);
} finally {
  await dispose();
}
```

**Kernel hosting note:** browsers can’t fetch kernels directly from NAIF due to CORS. `kernels.tspice()` points at a small community mirror for quickstart/testing and is **not recommended for production**. For production, self-host kernels (or proxy) and use `kernels.naif(...)` / `kernels.custom(...)`.

## Three audiences (and how to read the docs)

| You are… | What you’re trying to do | How to read `tspice` |
| --- | --- | --- |
| **App builder** (browser or Node) | Put SPICE into an app (visualization, tooling, services) | Start at the docs site (Guide/Examples): https://rybosome.github.io/tspice → then skim [`packages/tspice/README.md`](packages/tspice/README.md) for the canonical client API (`spiceClients`, `kernels`). |
| **SPICE power user** | Map existing SPICE mental models into TS and understand what’s “kit” vs “raw” | Use `spice.kit` for typed helpers, and `spice.raw` when you want backend/contract-level primitives. For method-level CSPICE mappings + parity notes, read [`docs/parity/spicebackend-cspice-mapping.md`](docs/parity/spicebackend-cspice-mapping.md). |
| **Contributor / backend hacker** | Work on backends, kernel loading, parity, packaging | Read Architecture on the docs site → then [`packages/backend-contract`](packages/backend-contract) and backend READMEs ([`packages/backend-wasm/README.md`](packages/backend-wasm/README.md), [`packages/backend-node/README.md`](packages/backend-node/README.md)). For CSPICE constraints, read [`docs/cspice-policy.md`](docs/cspice-policy.md). |

## Architecture (at a glance)

```mermaid
flowchart LR
  App[Your TS app] -->|spiceClients.to*()| Client[Spice client<br/>{ spice, dispose }]

  Client --> Kit[spice.kit<br/>Typed helpers]
  Client --> Raw[spice.raw<br/>Backend contract]

  subgraph KernelLoading[Kernel loading]
    Catalog[kernels.* catalogs] --> Pack[KernelPack<br/>URLs + virtual paths]
    Pack -->|withKernels(pack)| Client
  end

  Raw --> Wasm[@rybosome/tspice-backend-wasm<br/>CSPICE-derived .wasm]
  Raw --> Node[@rybosome/tspice-backend-node<br/>CSPICE-derived native addon]
```

A few important ideas:

- `spiceClients` gives you one consistent `spice` surface area (sync/async/WebWorker), while backends handle environment-specific details.
- The **WASM backend** enables real browser usage (and also runs in Node).
- The **Node backend** is a native addon backend for Node-specific workflows.

## Backend comparison (Node native vs WASM)

| | Node native (`backend: "node"`) | WASM (`backend: "wasm"`) |
| --- | --- | --- |
| Runs in | Node.js only | Browsers + Node.js |
| Artifact | Native addon (`.node`) | Prebuilt WebAssembly (`.wasm`) + JS glue |
| Best for | Node services, local kernel archives, potential performance wins | Browsers, Web Workers, portability and simpler installs |
| Kernel I/O shape | OS filesystem paths (plus optional byte staging) | Byte-backed loads into a virtual filesystem |
| Operational tradeoffs | Requires a compatible binding / toolchain | Needs the `.wasm` asset to be served/bundled correctly (may require an explicit `wasmUrl`) |
| Status | Actively evolving; parity/coverage may lag behind WASM in places | Actively evolving; heavily exercised by browser use cases |

## Kernel loading matrix (filesystem paths vs bytes/virtual paths)

`spice.kit.loadKernel()` accepts either:

- a **string path** (backend-native path semantics), or
- an object `{ path, bytes }` (portable, byte-backed load)

| Environment | Kernel source shape | Example | Notes |
| --- | --- | --- | --- |
| Node + native backend | filesystem path (`string`) | `spice.kit.loadKernel("/data/kernels/naif0012.tls")` | The string is an OS path. If you need to unload by OS path, prefer `spice.raw.unload(...)` (kit unloading is designed for virtual identifiers). |
| Browser + WASM backend | bytes + virtual path (`{ path, bytes }`) | `spice.kit.loadKernel({ path: "naif/naif0012.tls", bytes })` | `path` is a *virtual identifier* inside the WASM filesystem (normalized, no `..`). |
| Any runtime | `KernelPack` + `withKernels(...)` | `spiceClients.withKernels(kernelPack)` | Recommended for apps: preserves load order, stages bytes, and can resolve relative URLs via `pack.baseUrl`. |

## Design principles

- **TypeScript-first API:** typed inputs/outputs for common workflows via `spice.kit`, with escape hatches via `spice.raw`.
- **Backend-agnostic surface area:** one client API, multiple backend implementations.
- **Explicit kernels:** SPICE is kernel-driven and stateful; kernel load order matters and `tspice` keeps that reality visible.
- **Browser-realistic execution:** WebAssembly + Web Worker support for UI-friendly workloads.
- **Honest CSPICE posture:** CSPICE is an implementation dependency, not the product.

## Validation & trust (what you can rely on)

- **CSPICE usage constraints are explicit:** see [`docs/cspice-policy.md`](docs/cspice-policy.md) and [`docs/cspice-naif-disclosure.md`](docs/cspice-naif-disclosure.md).
- **Backend parity is a first-class concern:** the backend contract is documented method-by-method against CSPICE in [`docs/parity/spicebackend-cspice-mapping.md`](docs/parity/spicebackend-cspice-mapping.md), and this repo includes a YAML-driven verification harness (`packages/backend-verify`).
- **Kernels and licensing are treated carefully:** CSPICE source/toolkit archives are not committed; backend packages include authoritative `NOTICE` files describing what they ship and why.

## Roadmap (high-level)

- Expand backend parity coverage (Node ↔ WASM) with more fixtures and scenarios.
- Improve kernel catalogs (selection ergonomics, caching, and production guidance).
- Tighten docs + examples around real app workflows (Web Workers, bundlers, deployment).
- Move toward a stable 1.0 API once the surface area and backend contract settle.

## Stability & deprecation (pre-1.0)

`tspice` is currently **pre-1.0**.

- Expect API churn while the contract, kernel-loading ergonomics, and backend parity solidify.
- Breaking changes should be intentional and documented (and ideally preceded by `@deprecated` annotations where practical).
- If you’re shipping production code, pin versions and add your own validation tests for the specific kernels + workflows you rely on.
