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
  console.log(backend.kind); // "wasm"
  console.log(backend.spiceVersion());
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

  // Low-level backend primitives are available under `spice.cspice`.
  console.log(spice.cspice.tkvrsn("TOOLKIT"));
}

main().catch(console.error);
```

## API surface

- `createBackend(options: { backend: 'node' | 'wasm'; wasmUrl?: string | URL }): Promise<SpiceBackend>`
- `createSpice(options: { backend: 'node' | 'wasm'; wasmUrl?: string | URL }): Promise<Spice>`
- Types:
  - `BackendKind` (from `@rybosome/tspice-backend-contract`; `@rybosome/tspice` requires explicit `"node" | "wasm"` selection)
  - `SpiceBackend`
  - `SpiceKit`, `Spice`
  - Mid-level:
    - `Vec3`, `Vec6`, `Mat3`, `FrameName`, `AberrationCorrection`, `SpiceTime`
    - `StateVector`
    - `SpiceError`

### Selecting a backend

```ts
import { createBackend } from "@rybosome/tspice";

async function main() {
  const nodeBackend = await createBackend({ backend: "node" });
  const wasmBackend = await createBackend({ backend: "wasm" });
  console.log(nodeBackend.kind, wasmBackend.kind);
}

main().catch(console.error);
```

### Backend notes

- Node backend (`backend: "node"`): implemented by a native addon. Requires a compatible native binding to be present.
- WASM backend (`backend: "wasm"`): implemented with a prebuilt `.wasm`. See [`@rybosome/tspice-backend-wasm`](../backend-wasm/README.md).

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
