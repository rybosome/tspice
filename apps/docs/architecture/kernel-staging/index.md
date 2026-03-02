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

## Audit follow-up: non-direct/composite kernel behavior (`#569`)

Audit evidence:

- Issue scope: [#569](https://github.com/rybosome/tspice/issues/569)
- Audit callout: [#556 comment](https://github.com/rybosome/tspice/issues/556#issuecomment-3982873042)

### `furnsh` / `unload` / `kclear`: staging lifecycle differences

- **Node backend:**
  - `furnsh({ path, bytes })` stages bytes to a temp file and stores virtual-id ↔ temp-path mappings.
  - `unload(path)` resolves staged virtual IDs back to temp paths, then clears mapping state.
  - `kclear()` clears CSPICE state and removes all staged temp artifacts/mappings.
- **WASM backend:**
  - resolves all kernel paths into `/kernels/<normalized-id>` and rejects OS/URL-like string paths.
  - `furnsh`/`unload`/`kclear` operate in the in-memory Emscripten FS namespace.
- **Parity expectation:** for cross-backend portability, prefer `furnsh({ path, bytes })` and treat `path` as a virtual identifier.

Sources:

- Node staging lifecycle: [`kernel-staging.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-node/src/runtime/kernel-staging.ts#L37-L197)
- Node kernel domain hooks: [`backend-node/src/domains/kernels.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-node/src/domains/kernels.ts#L49-L81)
- WASM virtual-path constraints: [`backend-wasm/src/runtime/fs.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-wasm/src/runtime/fs.ts#L13-L35)
- WASM kernel domain hooks: [`backend-wasm/src/domains/kernels.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-wasm/src/domains/kernels.ts#L163-L192)

### `kinfo`: Node virtualization vs WASM cache

- **Node backend:** resolves lookup paths through the kernel stager, then virtualizes `kinfo().source` for staged kernels.
- **WASM backend:** builds a cache from `kdata("ALL")`, keyed by normalized virtual paths; cache invalidates on `furnsh`, `unload`, and `kclear`.
- **Parity expectation:** `kinfo` is intentionally backend-adapted internals with a shared contract surface (`Found<KernelInfo>`).

Sources:

- Node `kinfo` path resolution + virtualization: [`backend-node/src/domains/kernels.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-node/src/domains/kernels.ts#L106-L111), [`kernel-staging.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-node/src/runtime/kernel-staging.ts#L153-L197)
- WASM `kinfo` cache implementation: [`backend-wasm/src/domains/kernels.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-wasm/src/domains/kernels.ts#L124-L202)
- Parity spec coverage: [`kinfo@v1.yml`](https://github.com/rybosome/tspice/blob/main/packages/parity-checking/specs/methods/kernels/kinfo@v1.yml)

### `ktotal` / `kdata`: composite kind filtering path

- **Shared behavior:** both backends normalize kind input and use native calls only for directly representable queries.
- **Composite fallback:** for non-native composite kind inputs, both backends run an `ALL` query and apply JS-side filtering.
- **Node-specific extra step:** `kdata` virtualizes staged temp paths back to virtual IDs.
- **Parity-tooling note:** parity runner rewrites WASM virtual `kdata().file` IDs back to OS fixture paths for cross-backend comparability.

Sources:

- Shared kind normalization/filter helpers: [`kernels-utils.ts`](https://github.com/rybosome/tspice/blob/main/packages/core/src/spice-runtime/domains/kernels-utils.ts#L101-L259)
- Node composite filtering + virtualization: [`backend-node/src/domains/kernels.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-node/src/domains/kernels.ts#L82-L171)
- WASM composite filtering: [`backend-wasm/src/domains/kernels.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-wasm/src/domains/kernels.ts#L210-L258)
- Parity runner rewrite (`kdata`): [`tspiceRunner.ts`](https://github.com/rybosome/tspice/blob/main/packages/parity-checking/src/runners/tspiceRunner.ts#L303-L363)

### `kxtrct`: native call vs JS implementation

- **Node backend:** calls native `kxtrct` wrapper with input trimming and conservative size guards.
- **WASM backend:** uses shared JS helper `kxtrctJs`.
- **Parity expectation:** same contract output shape (`Found<{ wordsq; substr }>`), different internal path.

Sources:

- Node `kxtrct`: [`backend-node/src/domains/kernels.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-node/src/domains/kernels.ts#L113-L160), [`native kernels.cc`](https://github.com/rybosome/tspice/blob/main/packages/backend-node/native/src/domains/kernels.cc#L257-L359)
- WASM `kxtrctJs` path: [`backend-wasm/src/domains/kernels.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-wasm/src/domains/kernels.ts#L204-L206), [`kernels-utils.ts`](https://github.com/rybosome/tspice/blob/main/packages/core/src/spice-runtime/domains/kernels-utils.ts#L262-L307)

### `kplfrm`: intentional runtime/tooling split

- **Raw backend behavior:** Node exposes `kplfrm` directly; current WASM backend throws "not supported".
- **Parity-tooling behavior:** parity runner emulates WASM `kplfrm` by scanning `FRAME_*_CLASS` variables in the kernel pool.
- **Documentation intent:** this is an intentional tooling composite path, not raw WASM runtime parity.

Sources:

- Node `kplfrm`: [`backend-node/src/domains/kernels.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-node/src/domains/kernels.ts#L161-L171), [`native kernels.cc`](https://github.com/rybosome/tspice/blob/main/packages/backend-node/native/src/domains/kernels.cc#L362-L395)
- WASM unsupported raw path: [`backend-wasm/src/domains/kernels.ts`](https://github.com/rybosome/tspice/blob/main/packages/backend-wasm/src/domains/kernels.ts#L207-L209)
- Parity composite emulation: [`tspiceRunner.ts`](https://github.com/rybosome/tspice/blob/main/packages/parity-checking/src/runners/tspiceRunner.ts#L1081-L1119), [`kplfrm@v1.yml`](https://github.com/rybosome/tspice/blob/main/packages/parity-checking/specs/methods/kernels/kplfrm@v1.yml)

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
