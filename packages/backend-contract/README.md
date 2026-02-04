# @rybosome/tspice-backend-contract

## Overview

Shared TypeScript types that define the low-level **CSPICE-like** contract implemented by backend runtimes (native addon, WASM, etc.).

> This package intentionally exports **no runtime values** (types only). Always `import type` from it.

## What’s in this package

- `SpiceBackend`: the raw CSPICE-like function surface (`furnsh`, `kclear`, `pxform`, `spkezr`, ...)
- Supporting types used by that surface (for example `KernelSource`, `KernelKind`, `AbCorr`, matrix/vector shapes, etc.)

Notably, this contract intentionally keeps backend/runtime details minimal. It includes a
small `kind` discriminator for basic backend identification, but does **not** expose
backend-specific helpers like:

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
import fs from "node:fs/promises";

import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

export async function acceptsBackend(backend: SpiceBackend) {
  backend.kclear();
  // Prefer byte-backed kernel loading for backend portability.
  const bytes = await fs.readFile("/path/to/kernel.tm");
  backend.furnsh({ path: "kernel.tm", bytes });

  // When unloading byte-backed kernels, pass the same `path` you used above.
  backend.unload("kernel.tm");
  return backend.tkvrsn("TOOLKIT");
}
```

In browser/worker environments, you can fetch kernel bytes instead:

```ts
const res = await fetch("https://example.com/kernel.tm");
const bytes = new Uint8Array(await res.arrayBuffer());
backend.furnsh({ path: "kernel.tm", bytes });
```

### `furnsh(string)` is backend-dependent

`furnsh("/path/to/kernel.tm")` is valid, but **what filesystem that path refers
to depends on the backend**:

- **Node backend:** OS filesystem path.
- **WASM backend:** virtual WASM filesystem path (by convention under `/kernels`).

If you want code that works across backends, prefer `furnsh({ path, bytes })`.

## Development

```bash
pnpm --filter @rybosome/tspice-backend-contract run build
pnpm --filter @rybosome/tspice-backend-contract run typecheck
pnpm --filter @rybosome/tspice-backend-contract run test
```
