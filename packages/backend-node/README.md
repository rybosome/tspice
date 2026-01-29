# @rybosome/tspice-backend-node

## Overview

Node.js backend for `tspice`, implemented as a native addon (N-API via `node-gyp` + `node-addon-api`).

## CSPICE / NAIF disclosure

See [`docs/cspice-naif-disclosure.md`](../../docs/cspice-naif-disclosure.md) for the canonical disclosure text, NAIF links, and pointers to notice files.

This backend uses CSPICE-derived components via the native addon built under `native/`. See [`NOTICE`](./NOTICE) for authoritative information on licensing, provenance, integration, and redistribution.

## Purpose / Why this exists

This package is the “native” backend implementation that `@rybosome/tspice` uses when you select `createBackend({ backend: "node" })`. It’s where we expect the real SPICE bindings to live.

Right now the addon is a stub that only implements `spiceVersion()`.

## How it fits into `tspice`

- `@rybosome/tspice` calls `createNodeBackend()` from this package when `createBackend({ backend: "node" })` is selected.
- This package implements the shared `SpiceBackend` interface from `@rybosome/tspice-backend-contract`.

## Installation

You typically don’t install or import this directly. Most callers should use `@rybosome/tspice`.

If you’re working in this repo, it’s a pnpm workspace package.

## Usage (Quickstart)

### Typical usage (indirect)

```ts
import { createBackend } from "@rybosome/tspice";

async function main() {
  const backend = await createBackend({ backend: "node" });
  console.log(backend.spiceVersion());
}

main().catch(console.error);
```

### Direct usage (mostly for debugging)

```ts
import { createNodeBackend } from "@rybosome/tspice-backend-node";

const backend = createNodeBackend();
console.log(backend.spiceVersion());
```

## API surface

- `createNodeBackend(): SpiceBackend` (returns an object with methods like `spiceVersion(): string`)
- `spiceVersion(): string` (exported convenience wrapper around the loaded native addon)

## Requirements (contributors)

Building the native addon requires a working `node-gyp` toolchain.

- macOS: Xcode Command Line Tools
- Linux: Python 3 + `make` + a C/C++ toolchain (e.g. `build-essential`)

## Development

### Building the native addon

This will fetch pinned CSPICE into the repo-local cache automatically (unless `TSPICE_CSPICE_DIR` is set).

```bash
pnpm -C packages/backend-node build:native
```

### Building everything in this package (native + TS)

```bash
pnpm -C packages/backend-node build
```

### Typecheck + tests

```bash
pnpm -C packages/backend-node typecheck
pnpm -C packages/backend-node test
```

## Configuration

### `TSPICE_CSPICE_DIR`

By default, builds use CSPICE from the repo cache:

- `.cache/cspice/<toolkitVersion>/<platform>-<arch>/cspice`

If you set `TSPICE_CSPICE_DIR`, native builds will use CSPICE from that path instead. It must contain:

- `include/` (e.g. `SpiceUsr.h`)
- `lib/` (e.g. `cspice.a` and `csupport.a`)

### `TSPICE_BACKEND_NODE_BINDING_PATH`

By default, this package tries to load the addon from:

- `packages/backend-node/native/build/Release/tspice_backend_node.node`

If you set `TSPICE_BACKEND_NODE_BINDING_PATH`, that overrides the `.node` file location.

- If the value is an absolute path, it will be used as-is.
- If the value is relative, it’s resolved relative to this package root (the directory containing `packages/backend-node/package.json`).

Example:

```bash
TSPICE_BACKEND_NODE_BINDING_PATH=./native/build/Release/tspice_backend_node.node \
  node ./some-script.mjs
```

If you built a Debug addon locally, you can also point `TSPICE_BACKEND_NODE_BINDING_PATH` at it:

```bash
TSPICE_BACKEND_NODE_BINDING_PATH=./native/build/Debug/tspice_backend_node.node \
  node ./some-script.mjs
```

Note: relative paths like `./native/build/Debug/tspice_backend_node.node` are resolved relative to this package root (the directory containing `packages/backend-node/package.json`).

## Troubleshooting / FAQ

### “Native addon tspice_backend_node.node not found”

You likely haven’t built the addon yet:

```bash
pnpm -C packages/backend-node build:native
```

### “Failed to load tspice native backend ...”

This usually means the file exists but:

- it was built for a different Node version / platform / architecture, or
- it has missing dynamic library dependencies.

Rebuilding from a clean tree is often the quickest sanity check:

```bash
rm -rf packages/backend-node/native/build
pnpm -C packages/backend-node build:native
```

### Common `node-gyp` failures

- Python not found / wrong version
- Missing compiler toolchain

## Internals

- Native build definition: `native/binding.gyp`
- Native addon entrypoint: `native/src/addon.cc`
- Loader + error handling: `src/native.ts`

Note: the addon configures CSPICE error handling globally (e.g. sets the error action to `RETURN` so errors can be surfaced as JS exceptions).

## Versioning / stability notes

This is an A0 scaffold (`0.0.0`). Expect changes to the addon build, layout, and exported surface as real bindings are implemented.
