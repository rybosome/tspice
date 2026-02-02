# @rybosome/tspice-backend-contract

## Overview

Shared TypeScript types that define the low-level **CSPICE-like** contract implemented by backend runtimes (native addon, WASM, etc.).

## What’s in this package

- `SpiceBackend`: the raw CSPICE-like function surface (`furnsh`, `kclear`, `pxform`, `spkezr`, ...)
- Supporting types used by that surface (for example `KernelSource`, `KernelKind`, `AbCorr`, matrix/vector shapes, etc.)

Notably, this contract intentionally does **not** expose backend/runtime details like:

- backend identification (`kind`)
- WASM filesystem helpers (`writeFile`, `loadKernel`)

Backends may have internal helpers, but they are not part of the public `SpiceBackend` type.

## How it fits into `tspice`

- Backend implementations (`@rybosome/tspice-backend-node`, `@rybosome/tspice-backend-wasm`, ...) implement `SpiceBackend`.
- The public facade (`@rybosome/tspice`) consumes this type and re-exports `SpiceBackend`.

## Usage

### Implementing a backend

Backends should return an object that is assignable to `SpiceBackend`.

For reference implementations, see:

- `packages/backend-node/src/index.ts`
- `packages/backend-wasm/src/runtime/create-backend.*.ts`

### Consuming types

```ts
import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

export function acceptsBackend(backend: SpiceBackend) {
  backend.kclear();
  backend.furnsh("/path/to/kernel.tm");
  return backend.tkvrsn("TOOLKIT");
}
```

## Development

```bash
pnpm --filter @rybosome/tspice-backend-contract run build
pnpm --filter @rybosome/tspice-backend-contract run typecheck
pnpm --filter @rybosome/tspice-backend-contract run test
```
