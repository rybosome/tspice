# Backend: WASM

The WASM backend is the portable implementation of the `SpiceBackend` contract.

- Package: `packages/backend-wasm/` (`@rybosome/tspice-backend-wasm`)
- Runtime: an Emscripten-compiled CSPICE-derived `.wasm` + glue JS

This page focuses on what’s *specific* to the WASM backend.

## Where the artifacts live

Checked-in Emscripten outputs:

- `packages/backend-wasm/emscripten/tspice_backend_wasm.web.js`
- `packages/backend-wasm/emscripten/tspice_backend_wasm.web.wasm`
- `packages/backend-wasm/emscripten/tspice_backend_wasm.node.js`
- `packages/backend-wasm/emscripten/tspice_backend_wasm.wasm`

(The `.node.js` vs `.web.js` glue differs by environment, but the contract surface is the same.)

The C-side integration is just the shared shim compiled for WASM:

- `packages/backend-wasm/emscripten/tspice_backend_wasm_wrapper.c`

## Loader split: `create-backend.web.ts` vs `create-backend.node.ts`

The backend has two environment-specific constructors:

- Web: `packages/backend-wasm/src/runtime/create-backend.web.ts`
- Node: `packages/backend-wasm/src/runtime/create-backend.node.ts`

Conditional exports in `packages/backend-wasm/package.json` select the right one at runtime.

`packages/backend-wasm/src/index.ts` exists primarily to give TypeScript a stable type surface (TS doesn’t currently pick types per export condition).

## `wasmUrl` and `locateFile`

Both loaders support `wasmUrl?: string | URL` (see `CreateWasmBackendOptions`).

Why this exists:

- bundlers often relocate `.wasm` assets
- blob workers change what `import.meta.url` means

The Web loader:

- imports the glue JS via a literal `import("../tspice_backend_wasm.web.js")`
- passes a `locateFile()` callback so Emscripten can find the wasm binary by URL

If you see errors about failing to fetch/instantiate the module, the first thing to check is that the resolved `wasmUrl` points at the deployed `.wasm`.

Node loader specifics:

- prefers feeding bytes via `wasmBinary` for `file://...` URLs and filesystem paths (avoids Node `fetch` limitations)
- keeps a small bounded cache of wasm bytes to reduce repeated disk reads
- supports extra troubleshooting knobs in `CreateWasmBackendOptions`:
  - `validateEmscriptenModule` (defaults `true`)
  - `repairInvalidDistWasm` (defaults `false`)

## Kernel paths are always virtual

Unlike Node, the WASM backend treats kernel paths as virtual IDs under `/kernels/...`:

- `packages/backend-wasm/src/runtime/fs.ts` (`resolveKernelPath`)

This is enforced intentionally so “accidentally passed an OS path/URL” becomes an immediate, actionable error.

## Performance + worker guidance

The WASM backend is synchronous and CPU-heavy calls can block the current JS thread.

Typical guidance:

- **Browsers:** run it in a Web Worker to avoid blocking the UI.
- **Parallelism:** each worker/module instance has its own isolated CSPICE state, so you can scale out by running multiple workers (at the cost of duplicated wasm memory and kernel state).
- **Reuse:** instantiate the backend once per worker/process and reuse it; wasm startup + kernel loading can dominate for short-lived tasks.
