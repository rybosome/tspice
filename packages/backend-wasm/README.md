# @rybosome/tspice-backend-wasm

## Overview

WASM backend for `tspice`.

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

const backend = createBackend({ backend: "wasm" });
console.log(backend.kind); // "wasm"
console.log(backend.spiceVersion()); // "wasm-stub" (for now)
```

## API surface

- `createWasmBackend(): SpiceBackend`

## Development

```bash
pnpm -C packages/backend-wasm build
pnpm -C packages/backend-wasm typecheck
pnpm -C packages/backend-wasm test
```

## Troubleshooting / FAQ

### “Is this a real WASM backend?”

Not yet. The current implementation is a stub and does not compile or execute any WebAssembly.

## Versioning / stability notes

This is an A0 scaffold (`0.0.0`) and the implementation is expected to change substantially.
