# Backend: Node (native addon)

The Node backend is the “native” implementation of the `SpiceBackend` contract.

- Package: `packages/backend-node/` (`@rybosome/tspice-backend-node`)
- Primary output: a `.node` addon loaded via N-API (`node-addon-api` + `node-gyp`)

This page focuses on what’s *specific* to the Node backend.

## High-level layout

### TypeScript composition layer

- Entry point: `packages/backend-node/src/index.ts`

This file composes the backend by:

- loading the native addon (`getNodeBinding()` → `getNativeAddon()`)
- constructing runtime helpers (kernel stager, virtual output stager, handle registries)
- spreading per-domain wrappers into a single `SpiceBackend` object

Domain wrappers live under:

- `packages/backend-node/src/domains/*`

### Native addon

- Build definition: `packages/backend-node/native/binding.gyp`
- Addon entrypoint: `packages/backend-node/native/src/addon.cc`

The addon registers a set of “domain spokes” implemented in C++:

- `packages/backend-node/native/src/domains/*`

It also compiles in the shared C shim from `packages/backend-shim-c/` (see the `sources` list in `binding.gyp`).

## Concurrency model: one global CSPICE lock

CSPICE is not treated as re-entrant.

The native addon serializes *all* CSPICE + shared-registry operations behind a single process-global mutex:

- `packages/backend-node/native/src/addon_common.{h,cc}` (`g_cspice_mutex`)

This is why you should assume the backend is logically single-threaded even if you call it from concurrent JS tasks.

## Kernel + output staging

Node has two staging layers to make the contract feel consistent with WASM:

- **Kernel staging (byte-backed kernels):** `packages/backend-node/src/runtime/kernel-staging.ts`
  - writes `{ path, bytes }` kernels to temp files
  - remembers virtual id → temp path mappings so `unload()` works
  - virtualizes `kdata()` / `kinfo()` output paths back into virtual ids
- **Virtual output staging:** `packages/backend-node/src/runtime/virtual-output-staging.ts`
  - resolves `VirtualOutput` targets to temp files
  - allows reading bytes back after closing writer handles

## Prebuilt `.node` packaging

In addition to local builds (`packages/backend-node/native/build/Release/tspice_backend_node.node`), there are platform-specific prebuilt packages:

- `packages/tspice-native-darwin-arm64/`
- `packages/tspice-native-darwin-x64/`
- `packages/tspice-native-linux-x64-gnu/`

The loader (`packages/backend-node/src/runtime/addon.ts`) chooses the addon in this order:

1. `TSPICE_BACKEND_NODE_BINDING_PATH` (explicit override)
2. a matching `@rybosome/tspice-native-*` package (if installed)
3. the local monorepo build output under `packages/backend-node/native/build/Release/`

This setup lets consumers avoid a toolchain when a prebuilt binary is available, while still keeping a source-build path for contributors.
