# @rybosome/tspice

## Overview

`@rybosome/tspice` is the public facade for this repo: it gives you a single `createBackend()` entrypoint and selects an underlying backend implementation (Node/native or WASM).

## Purpose / Why this exists

The long-term goal is to expose a stable, ergonomic JavaScript/TypeScript API for SPICE functionality while keeping the “how” of execution (native addon, WASM, remote, etc.) behind an interface.

This package is the package most callers should depend on.

## How it fits into `tspice`

At runtime, `createBackend()` chooses a backend and returns a `SpiceBackend` implementation.

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
  console.log(backend.kind); // "node" (default)
  console.log(backend.spiceVersion());
}

main();
```

## API surface

- `createBackend(options?: { backend?: BackendKind; wasmUrl?: string | URL }): Promise<SpiceBackend>`
- Types:
  - `BackendKind` (currently `"node" | "wasm"`)
  - `SpiceBackend`

### Selecting a backend

```ts
import { createBackend } from "@rybosome/tspice";

async function main() {
  const nodeBackend = await createBackend({ backend: "node" });
  const wasmBackend = await createBackend({ backend: "wasm" });
  console.log(nodeBackend.kind, wasmBackend.kind);
}

main();
```

### Backend notes

- Node backend (`backend: "node"`): implemented by a native addon; requires a build step when working from source. See [`@rybosome/tspice-backend-node`](../backend-node/README.md).
- WASM backend (`backend: "wasm"`): implemented with a prebuilt `.wasm`. See [`@rybosome/tspice-backend-wasm`](../backend-wasm/README.md).

## Development

```bash
pnpm -C packages/tspice build
pnpm -C packages/tspice typecheck
pnpm -C packages/tspice test
```

## Troubleshooting / FAQ

### “Native addon tspice_backend_node.node not found” / “Failed to load tspice native backend ...”

The default backend is the Node/native backend. If you’re running from the workspace and haven’t built the addon yet:

```bash
pnpm -C packages/backend-node build:native
```

For more details (including `TSPICE_BACKEND_NODE_BINDING_PATH`), see [`@rybosome/tspice-backend-node`](../backend-node/README.md).

## Versioning / stability notes

This is an A0 scaffold (`0.0.0`) and the API shape is expected to churn.
