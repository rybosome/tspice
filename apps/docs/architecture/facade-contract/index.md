# Facade + contract seam

At a high level:

- **`@rybosome/tspice`** is the public facade (what most consumers import).
- **`SpiceBackend`** (from `@rybosome/tspice-backend-contract`) is the seam: a shared interface that backends must satisfy.
- **Backends** (`backend-node`, `backend-wasm`, etc.) implement `SpiceBackend`.

This page focuses on how the facade selects/creates a backend, and how the contract is structured so contributors can add capabilities without turning the codebase into one giant file.

## Backend selection (`createBackend`)

Source: `packages/tspice/src/backend.ts`

`createBackend()` forces callers (even JS callers) to pick a backend explicitly:

- `{ backend: "node" }` → load `@rybosome/tspice-backend-node`
- `{ backend: "wasm", wasmUrl?: string | URL }` → load `@rybosome/tspice-backend-wasm`

The Node backend import is intentionally **non-static** so “JS-only” CI lanes can run without building the native addon:

```ts
// packages/tspice/src/backend.ts
const nodeBackendSpecifier = "@rybosome/tspice-backend-" + "node";
const { createNodeBackend } = await import(nodeBackendSpecifier);
```

## Wrapping into `{ raw, kit }` (`createSpice`)

Source: `packages/tspice/src/spice.ts`

`createSpice()` is the main facade constructor. It either:

- uses a provided `backendInstance` (advanced/testing), or
- calls `createBackend(options)`.

It then returns:

- `raw`: a `SpiceBackend` proxy around the backend instance
- `kit`: a thin, higher-level convenience layer built on top of `raw`

### Why `raw` is a Proxy

The proxy in `createSpice()` exists to make backend methods safe to pass around:

- preserves prototype methods (object spread would drop them)
- binds methods to the original backend instance (`this` is stable)
- ensures method identity is stable (`raw.furnsh === raw.furnsh`)

### `kclear()` + `byteBackedKernelPaths`

`createSpice()` creates a `Set<string>` called `byteBackedKernelPaths` and passes it into `createKit()`.

Today it’s used to track kernels loaded from bytes so `kit.loadKernel()` / `kit.unloadKernel()` can accept flexible virtual path spellings (e.g. `"naif0012.tls"` vs `"/kernels/naif0012.tls"`) across backends.

Because `kclear()` resets the CSPICE kernel pool globally, `createSpice()` also wraps `raw.kclear()` so the set is cleared whenever the backend is cleared.

## How the backend contract is composed (domains)

Source: `packages/backend-contract/src/index.ts`

`SpiceBackend` is built by *composing* a set of small “domain” interfaces:

- `TimeApi`
- `KernelsApi`
- `KernelPoolApi`
- `FramesApi`
- …

Each domain lives under `packages/backend-contract/src/domains/*`.

Both backends follow the same composition pattern: they build one backend object by spreading the per-domain factories:

- Node: `packages/backend-node/src/index.ts`
- WASM: `packages/backend-wasm/src/runtime/create-backend.{node,web}.ts`

This keeps “add a new SPICE capability” work localized to a domain instead of requiring invasive changes everywhere.

## Adding a new capability (contributor checklist)

When you add a new SPICE binding, treat it as a contract change that must land *end-to-end*:

1. **Contract:** add types + method signature to `@rybosome/tspice-backend-contract` (usually in an existing `src/domains/*.ts` file, then re-export via `src/index.ts`).
2. **Shared shim:** implement a stable C ABI wrapper in `packages/backend-shim-c/`:
   - update `include/tspice_backend_shim.h`
   - add/extend a C implementation in `src/domains/*.c`
3. **Node backend:**
   - expose the binding from the native addon (`packages/backend-node/native/src/domains/*`)
   - add/update the TS domain wrapper (`packages/backend-node/src/domains/*`)
4. **WASM backend:**
   - ensure the shim code is compiled into the `.wasm` (see `packages/backend-wasm/emscripten/tspice_backend_wasm_wrapper.c`)
   - add/update the TS domain wrapper (`packages/backend-wasm/src/domains/*`)
   - (when applicable) update the Emscripten module assertions in `packages/backend-wasm/src/lowlevel/exports.ts`
5. **Tests / parity:** add or update verification coverage (see `packages/backend-verify/`).

Parity mapping doc (outside the VitePress tree):

- [`docs/parity/spicebackend-cspice-mapping.md`](https://github.com/rybosome/tspice/blob/main/docs/parity/spicebackend-cspice-mapping.md)
