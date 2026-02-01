# @rybosome/tspice-backend-fake

## Overview

A deterministic, pure-TypeScript “toy” implementation of the `SpiceBackend` interface.

It’s useful for tests and for environments where the native and WASM backends aren’t available. It is intentionally **not** a physically-accurate ephemeris.

## Purpose / Why this exists

This package exists to:

- provide a stable backend for unit tests and smoke tests
- make it possible to exercise higher-level `tspice` code without requiring CSPICE or a native build

**Who should touch this:** contributors working on the backend contract or tests. If you add/change methods in `@rybosome/tspice-backend-contract`, this backend usually needs updating to keep parity.

## How it fits into `tspice`

- Implements the shared `SpiceBackend` interface from `@rybosome/tspice-backend-contract`.
- Used by repo-local tests and by the `@rybosome/tspice` packaging verification scripts.

## Installation

This is a workspace-internal package (`private: true`). You typically don’t install it outside this repo.

## Usage (Quickstart)

```ts
import { createFakeBackend } from "@rybosome/tspice-backend-fake";

const backend = createFakeBackend();
console.log(backend.spiceVersion());

const moonFromEarth = backend.spkpos("MOON", 123.456, "J2000", "NONE", "EARTH");
console.log(moonFromEarth.pos);
```

## API surface

- `createFakeBackend(): SpiceBackend`
- `FAKE_SPICE_VERSION: string`

## Notes / limitations

These behaviors are intentionally simplified (see `src/index.ts` for authoritative details):

- `str2et` only supports ISO-8601 / RFC3339-style UTC timestamps.
- Leap seconds are ignored.
- The J2000 epoch is treated as `2000-01-01T12:00:00Z`.

## Development

```bash
pnpm --filter @rybosome/tspice-backend-fake run build
pnpm --filter @rybosome/tspice-backend-fake run typecheck
pnpm --filter @rybosome/tspice-backend-fake run test
```
