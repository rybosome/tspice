# @rybosome/tspice-backend-contract

## Overview

Shared types and constants that define the contract between `@rybosome/tspice` and backend implementations.

## Purpose / Why this exists

Backends are intended to be swappable (native addon, WASM, remote, etc.). This package centralizes the interface they must implement so:

- backend packages can implement a shared `SpiceBackend` interface
- the `@rybosome/tspice` facade can select a backend without importing backend-specific types

## How it fits into `tspice`

- `@rybosome/tspice` re-exports `BackendKind` and `SpiceBackend` from here.
- Backend implementations (`@rybosome/tspice-backend-node`, `@rybosome/tspice-backend-wasm`, and future backends) import these types to ensure they match the expected API.

## Installation

You typically don’t install this package directly. It is a workspace-internal dependency of the facade and backend packages.

## Usage (Quickstart)

### Implementing a backend

```ts
import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

export function createExampleBackend(): SpiceBackend {
  return {
    kind: "node",
    spiceVersion: () => "example"
  };
}
```

### Consuming types

```ts
import type { BackendKind, SpiceBackend } from "@rybosome/tspice-backend-contract";

export function acceptsBackendKind(kind: BackendKind): BackendKind {
  return kind;
}

function acceptsBackend(backend: SpiceBackend) {
  backend.spiceVersion();
}
```

## Concepts

### `BACKEND_KINDS` / `BackendKind`

`BACKEND_KINDS` is the canonical list of supported backends. `BackendKind` is derived from it:

```ts
export const BACKEND_KINDS = ["node", "wasm"] as const;
export type BackendKind = (typeof BACKEND_KINDS)[number];
```

### `SpiceBackend`

`SpiceBackend` is the interface the facade (`@rybosome/tspice`) works with. Each backend package returns an object that implements this interface.

## Adding a new backend kind

When you add a new backend kind, you generally update:

1. `packages/backend-contract/src/index.ts`: add to `BACKEND_KINDS`.
2. `packages/tspice/src/index.ts`: add a new `case` to `createBackend()`.
3. Add a backend package (or update an existing one) that returns a `SpiceBackend` with `kind` set to your new value.
4. Update tests to cover the new selection and behavior.

## API surface

- `BACKEND_KINDS: readonly ["node", "wasm", ...]`
- `BackendKind: (typeof BACKEND_KINDS)[number]`
- `SpiceBackend` interface

## Development

```bash
pnpm -C packages/backend-contract build
pnpm -C packages/backend-contract typecheck
pnpm -C packages/backend-contract test
```

## Versioning / stability notes

This is an A0 scaffold (`0.0.0`) and the contract may change as real backend functionality is added.
