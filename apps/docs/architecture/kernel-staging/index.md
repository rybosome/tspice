# Kernel staging + virtual paths

Kernel loading is one of the main places the Node and WASM backends *intentionally* diverge.

The contract surface tries to keep the caller experience consistent by using:

- a shared `KernelSource` type
- a shared “virtual path” identity model

## `KernelSource`: path vs bytes

Source type: `packages/backend-contract/src/shared/types.ts`

```ts
export type KernelSource =
  | string
  | {
      path: string;
      bytes: Uint8Array;
    };
```

Two important conventions:

- `KernelSource = string` means **“backend-native path”**
  - Node backend: OS filesystem path
  - WASM backend: virtual WASM-FS path (under `/kernels/...`)
- `KernelSource = { path, bytes }` means **“byte-backed kernel”**
  - `path` is a **virtual identifier**, not an OS path

If you want portable behavior across backends, prefer passing bytes and treating the `path` as an ID.

## Virtual kernel identity (`normalizeVirtualKernelPath`)

Shared helper: `packages/core/src/index.ts` (`@rybosome/tspice-core`)

`normalizeVirtualKernelPath(input)` intentionally does *not* behave like general filesystem normalization:

- rejects `..`
- strips leading slashes and `kernels/` prefixes
- collapses repeated slashes and `.` segments

This lets callers use flexible spellings like:

- `"naif0012.tls"`
- `"kernels/naif0012.tls"`
- `"/kernels//naif0012.tls"`

…while still producing a stable canonical ID (`"naif0012.tls"`).

## WASM backend: in-memory FS under `/kernels`

Relevant code:

- `packages/backend-wasm/src/runtime/fs.ts`
- `packages/backend-wasm/src/domains/kernels.ts`

In the WASM backend:

- all kernel paths are treated as *virtual* paths
- the canonical resolved form is `/kernels/<normalized-id>`
- byte-backed kernels are written into the Emscripten FS before calling `furnsh`

The helper `resolveKernelPath()` in `fs.ts` also rejects common “wrong backend” inputs (URLs, Windows drive paths, absolute POSIX paths outside `/kernels/...`) to make failures debuggable.

## Node backend: OS paths + temp-file staging for bytes

Relevant code:

- `packages/backend-node/src/runtime/kernel-staging.ts`
- `packages/backend-node/src/domains/kernels.ts`

In the Node backend:

- `furnsh(string)` is treated as an OS filesystem path (unless the caller explicitly opts into the virtual namespace).
- byte-backed kernels are written to a temp file (under `os.tmpdir()`) and loaded via CSPICE.

To keep behavior consistent with WASM, the Node kernel stager:

- canonicalizes virtual ids to `/kernels/<normalized-id>`
- remembers the mapping from virtual id → temp file path
- virtualizes introspection outputs so `kdata().file` / `kinfo().source` report the **virtual id**, not the temp path

## Virtual outputs (Node backend)

Writer APIs sometimes target a `VirtualOutput` instead of an OS path.

Type: `packages/backend-contract/src/shared/types.ts`

```ts
export type VirtualOutput = { kind: "virtual-output"; path: string };
```

In Node, virtual outputs are staged to temp files via:

- `packages/backend-node/src/runtime/virtual-output-staging.ts`

Key lifecycle rule: a virtual output is only guaranteed readable *after* the writer handle has been closed (e.g. `spkcls(handle)` for SPKs).

## Common failure modes + debug tips

- **WASM backend:** passing OS paths/URLs to `furnsh()` will throw (by design). Use byte-backed kernels or virtual ids.
- **Unloading kernels:** prefer `kit.unloadKernel()` when working with virtual ids; it normalizes paths consistently.
- **`kclear()` consistency:** `kclear()` resets the global CSPICE kernel state.
  - `@rybosome/tspice` wraps `raw.kclear()` to keep internal kernel tracking in sync (see `packages/tspice/src/spice.ts`).
- **Virtual outputs:** if `readVirtualOutput()` fails, confirm you closed the writer handle first.
