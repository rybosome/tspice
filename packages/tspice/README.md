# @rybosome/tspice

## Overview

`@rybosome/tspice` is the public facade for this repo: it gives you a single `createBackend()` entrypoint and lets you select an underlying backend implementation (Node/native or WASM).

## CSPICE / NAIF disclosure

See [`docs/cspice-naif-disclosure.md`](../../docs/cspice-naif-disclosure.md) for the canonical disclosure text, NAIF links, and pointers to notice files.

Depending on `@rybosome/tspice` will typically pull in backend packages that ship CSPICE-derived components; see each backend package `NOTICE` for details.

## Purpose / Why this exists

The long-term goal is to expose a stable, ergonomic JavaScript/TypeScript API for SPICE functionality while keeping the “how” of execution (native addon, WASM, remote, etc.) behind an interface.

This package is the package most callers should depend on.

## How it fits into `tspice`

At runtime, `createBackend()` creates the backend you request and returns a `Promise<SpiceBackend>`.

```
@rybosome/tspice
  ├─ selects one of:
  │   ├─ @rybosome/tspice-backend-node (native addon)
  │   └─ @rybosome/tspice-backend-wasm (wasm)
  ├─ uses shared types from @rybosome/tspice-backend-contract
  └─ uses shared utilities from @rybosome/tspice-core
```

## Installation

In this repo, packages are typically used via the pnpm workspace and are marked `private: true`.

### ESM-only (published package)

The published `@rybosome/tspice` package is **ESM-only** (`type: "module"`). It does not ship a CommonJS (`require()`) entrypoint.

If you're in a CommonJS project, use a dynamic import:

```js
const { createBackend } = await import("@rybosome/tspice");
```

## Usage (Quickstart)

```ts
import { createBackend } from "@rybosome/tspice";

async function main() {
  const backend = await createBackend({ backend: "wasm" });

  // Useful for diagnostics, but not a way to distinguish backends:
  // the CSPICE toolkit version is typically identical across backends.
  console.log(backend.tkvrsn("TOOLKIT"));
}

main().catch(console.error);
```

## Usage (Mid-level API)

The mid-level API provides a thin, typed wrapper layer over the low-level SPICE primitives:

```ts
import { createSpice } from "@rybosome/tspice";

async function main() {
  const spice = await createSpice({ backend: "wasm" });

  // Load kernels from disk (or provide { path, bytes } for in-memory kernels).
  spice.kit.loadKernel("/path/to/naif0012.tls");
  spice.kit.loadKernel("/path/to/de405s.bsp");

  const et = spice.kit.utcToEt("2000 JAN 01 12:00:00");

  const state = spice.kit.getState({
    target: "EARTH",
    observer: "SUN",
    at: et,
    frame: "J2000",
    aberration: "NONE",
  });

  console.log(state.position, state.velocity, state.lightTime);

  // Low-level backend primitives are available under `spice.raw`.
  console.log(spice.raw.tkvrsn("TOOLKIT"));
}

main().catch(console.error);
```

## API surface

- `createBackend(options: { backend: 'node' | 'wasm'; wasmUrl?: string | URL }): Promise<SpiceBackend>`
- `createSpice(options: { backend: 'node' | 'wasm'; wasmUrl?: string | URL }): Promise<Spice>`
- Types:
  - `SpiceBackend`
  - `SpiceKit`, `Spice`
  - Mid-level:
    - `Vec3`, `Vec6`, `Mat3` (wrapper), `Mat3RowMajor`, `Mat3ColMajor`, `FrameName`, `AberrationCorrection`, `SpiceTime`
    - `StateVector`
    - `SpiceError`

### Client builder + caching

`spiceClients` provides a small builder for creating sync/async/worker clients, with optional in-memory caching.

When using `.synchronous().caching(...)`, caching is applied at the transport (RPC) layer.
It memoizes returned values per `(op, args)`:

- Only **successful** calls are cached (throws are not cached).
- Cached values are returned by reference (they may be objects/arrays). Treat cached results as immutable — do not mutate them.
- Kernel-mutating ops (e.g. `kit.loadKernel`, `raw.furnsh`) default to `"no-store"`.
- Kernel mutations do **not** automatically invalidate the cache, so cached results can become stale if you load/unload kernels mid-session.

Recommendation: call the build result’s `dispose()` when you’re done (it clears caches + stops any TTL sweep timers), and consider rebuilding/clearing the cache after kernel mutations.

### Selecting a backend

```ts
import { createBackend } from "@rybosome/tspice";

async function main() {
  const nodeBackend = await createBackend({ backend: "node" });
  const wasmBackend = await createBackend({ backend: "wasm" });
  // `tkvrsn("TOOLKIT")` reports the underlying CSPICE toolkit version.
  // It is useful for debugging, but usually not different between backends.
  console.log(nodeBackend.tkvrsn("TOOLKIT"), wasmBackend.tkvrsn("TOOLKIT"));
}

main().catch(console.error);
```

### Backend notes

- Node backend (`backend: "node"`): implemented by a native addon. Requires a compatible native binding to be present.
- WASM backend (`backend: "wasm"`): implemented with a prebuilt `.wasm`. See [`@rybosome/tspice-backend-wasm`](../backend-wasm/README.md).

Both backends currently require a CSPICE build where `sizeof(SpiceInt) == 4` (32-bit `SpiceInt`).

## Development

```bash
pnpm --filter @rybosome/tspice run build
pnpm --filter @rybosome/tspice run typecheck
pnpm --filter @rybosome/tspice run test
```

## Troubleshooting / FAQ

### “Native addon tspice_backend_node.node not found” / “Failed to load tspice native backend ...”

If you selected the Node/native backend (`backend: "node"`) and you’re running from the workspace and haven’t built the addon yet:

```bash
pnpm --filter @rybosome/tspice-backend-node run build:native
```

For more details (including `TSPICE_BACKEND_NODE_BINDING_PATH`), see [`@rybosome/tspice-backend-node`](../backend-node/README.md).

## Versioning

This package is under active development and the API shape is expected to churn.
