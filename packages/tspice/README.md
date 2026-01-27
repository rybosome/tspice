# @rybosome/tspice

## Overview

`@rybosome/tspice` is the public facade for this repo: it gives you a single `createBackend()` entrypoint and selects an underlying backend implementation (Node/native or WASM).

## CSPICE / NAIF disclosure

See [`docs/cspice-naif-disclosure.md`](../../docs/cspice-naif-disclosure.md) for the canonical disclosure text, NAIF links, and pointers to notice files.

Depending on `@rybosome/tspice` will typically pull in backend packages that ship CSPICE-derived components; see each backend package `NOTICE` for details.

## Purpose / Why this exists

The long-term goal is to expose a stable, ergonomic JavaScript/TypeScript API for SPICE functionality while keeping the “how” of execution (native addon, WASM, remote, etc.) behind an interface.

This package is the package most callers should depend on.

## How it fits into `tspice`

At runtime, `createBackend()` chooses a backend and returns a `Promise<SpiceBackend>`.

```
@rybosome/tspice
  ├─ selects one of:
  │   ├─ @rybosome/tspice-backend-node (native addon)
  │   └─ @rybosome/tspice-backend-wasm (wasm)
  ├─ uses shared types from @rybosome/tspice-backend-contract
  └─ uses shared utilities from @rybosome/tspice-core
```

## Installation

This repo is currently an A0 scaffold and packages are marked `private: true`, so you typically use it via the workspace.

## Usage (Quickstart)

```ts
import { createBackend } from "@rybosome/tspice";

async function main() {
  const backend = await createBackend();
  console.log(backend.kind); // "wasm" (default)
  console.log(backend.spiceVersion());
}

main().catch(console.error);
```

## Usage (Mid-level API)

Phase 4 introduces a thin, typed wrapper layer over the low-level SPICE primitives:

```ts
import { createSpice } from "@rybosome/tspice";

async function main() {
  const spice = await createSpice({ backend: "wasm" });

  // Load kernels from disk (or provide { path, bytes } for in-memory kernels).
  spice.loadKernel("/path/to/naif0012.tls");
  spice.loadKernel("/path/to/de405s.bsp");

  const et = spice.utcToEt("2000 JAN 01 12:00:00");

  const state = spice.getState({
    target: "EARTH",
    observer: "SUN",
    at: et,
    frame: "J2000",
    aberration: "NONE",
  });

  console.log(state.position, state.velocity, state.lightTime);

  // `createSpice()` also forwards the low-level backend primitives at the
  // top-level, so you can call e.g. `spice.furnsh()` directly.
  console.log(spice.tkvrsn("TOOLKIT"));
}

main().catch(console.error);
```

## API surface

- `createBackend(options?: { backend?: BackendKind; wasmUrl?: string | URL }): Promise<SpiceBackend>`
- `createSpice(options?: { backend?: BackendKind; wasmUrl?: string | URL }): Promise<Spice>`
- Types:
  - `BackendKind` (currently `"node" | "wasm"`)
  - `SpiceBackend`
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

- Node backend (`backend: "node"`): implemented by a native addon. It's currently best-effort / smoke-only and must be explicitly opted into via `createBackend({ backend: "node" })`. See [`@rybosome/tspice-backend-node`](../backend-node/README.md).
- WASM backend (`backend: "wasm"`): implemented with a prebuilt `.wasm`. See [`@rybosome/tspice-backend-wasm`](../backend-wasm/README.md).

## Development

```bash
pnpm -C packages/tspice build
pnpm -C packages/tspice typecheck
pnpm -C packages/tspice test
```

## Troubleshooting / FAQ

### “Native addon tspice_backend_node.node not found” / “Failed to load tspice native backend ...”

If you opt into the Node/native backend from the workspace and haven’t built the addon yet:

```bash
pnpm -C packages/backend-node build:native
```

For more details (including `TSPICE_BACKEND_NODE_BINDING_PATH`), see [`@rybosome/tspice-backend-node`](../backend-node/README.md).

## Versioning / stability notes

This is an A0 scaffold (`0.0.0`) and the API shape is expected to churn.
