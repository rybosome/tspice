# @rybosome/tspice-backend-wasm

## Overview

WASM backend for `tspice`, implemented with a prebuilt Emscripten-compiled CSPICE `.wasm`.

## Purpose / Why this exists

This package exists to reserve a “WASM backend” slot in the architecture so we can evolve toward a portable (non-native-addon) backend over time.

## How it fits into `tspice`

- `@rybosome/tspice` calls `createWasmBackend()` from this package when `createBackend({ backend: "wasm" })` is selected.
- This package implements the shared `SpiceBackend` interface from `@rybosome/tspice-backend-contract`.

## Installation

You typically don’t install or import this directly. Most callers should use `@rybosome/tspice`.

## Usage (Quickstart)

```ts
import { createBackend } from "@rybosome/tspice";

async function main() {
  const backend = await createBackend({ backend: "wasm" });
  console.log(backend.kind); // "wasm"
  console.log(backend.spiceVersion());
}

main();
```

## API surface

- `createWasmBackend(options?: { wasmUrl?: string | URL }): Promise<SpiceBackend>`

## Development

```bash
pnpm -C packages/backend-wasm build
pnpm -C packages/backend-wasm typecheck
pnpm -C packages/backend-wasm test
```

## Troubleshooting / FAQ

### “Where does the `.wasm` file come from?”

The `.wasm` file is checked into the repo as a prebuilt artifact so the portable CI lane can load and execute it without requiring an Emscripten toolchain.

To regenerate the checked-in artifact locally, run `node scripts/build-backend-wasm.mjs` (requires `emcc` in your `PATH`).

## Versioning / stability notes

This is an A0 scaffold (`0.0.0`) and the implementation is expected to change substantially.
