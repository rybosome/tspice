# @rybosome/tspice-backend-wasm

## Overview

WASM backend for `tspice`, implemented with a prebuilt Emscripten-compiled CSPICE `.wasm`.

## CSPICE / NAIF disclosure

This project embeds components derived from the NAIF CSPICE Toolkit solely to support its TypeScript interface. It is not a general-purpose distribution of CSPICE.

In this package, those components are incorporated into the prebuilt `.wasm` artifact.

Use of CSPICE (including CSPICE-derived artifacts from this project) is subject to the NAIF rules linked below.

- NAIF rules: https://naif.jpl.nasa.gov/naif/rules.html
- Official NAIF toolkit download site: https://naif.jpl.nasa.gov/naif/toolkit.html

For third-party notices and additional details, see [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) and the [`NOTICE`](./NOTICE) file in this package.

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

main().catch(console.error);
```

The JS glue (`tspice_backend_wasm.js`) and WebAssembly binary (`tspice_backend_wasm.wasm`) are expected to be colocated. If your bundler or deployment setup relocates the `.wasm` asset, pass an explicit `wasmUrl`.

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
