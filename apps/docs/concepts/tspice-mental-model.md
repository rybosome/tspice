# tspice mental model

This page is the “shape of the world” for tspice: what runs where, what’s stateful, and what conventions everything assumes.

## What it is

`tspice` is a TypeScript facade over SPICE (CSPICE), with multiple interchangeable backends:

- **Node/native addon** backend (fast, sync-ish)
- **WASM** backend (browser-friendly; async)
- **Web Worker** wrapper (WASM in a worker; async)

All backends expose the same two API layers:

- `spice.raw`: CSPICE-shaped primitives
- `spice.kit`: convenience wrappers with nicer types and defaults

## Why it matters

SPICE is extremely capable, but it’s also **stateful** and full of conventions.

If you internalize the split between `raw` and `kit`, plus the big pieces of global state (kernel pool, time defaults), you’ll avoid most “why is this wrong?” moments.

## Kernels required

None are required to _use tspice itself_.

That said, most useful SPICE operations require kernels (LSK/SPK/PCK/...). Each domain page calls out what it needs.

## How it maps to tspice

### `raw` vs `kit`

- **`raw`** is the backend contract surface area: methods like `str2et`, `pxform`, `spkezr`, `furnsh`, etc.
  - Outputs are low-level JS shapes (arrays, plain objects) that match the backend-contract types.
- **`kit`** is a thin, opinionated layer built on `raw`:
  - friendlier method names (`utcToEt` instead of `str2et`)
  - small default choices (e.g. `getState()` defaults to frame `"J2000"` and aberration `"NONE"`)
  - wrappers like `Mat3` that expose both row-major and column-major layouts

Example (async client; in sync clients, omit `await`):

```ts
// Assume you already constructed `spice` via `spiceClients`.

const et = await spice.kit.utcToEt("2000 JAN 01 12:00:00");

// kit: structured output
const state = await spice.kit.getState({ target: "EARTH", observer: "SUN", at: et });

// raw: direct CSPICE parity
const et2 = await spice.raw.str2et("2000 JAN 01 12:00:00");
const { state: rawState, lt } = await spice.raw.spkezr("EARTH", et2, "J2000", "NONE", "SUN");
```

### Error handling (`throw`, SPICE messages, and `reset()`)

- On SPICE failures, tspice surfaces a **thrown JS error**.
- Backends configure CSPICE to **return control** instead of aborting (`ERRACT = RETURN`) and to **not print** directly (`ERRPRT = NONE`).
- When a SPICE failure happens, tspice captures the SPICE error message(s) and **automatically calls SPICE `reset()`** before throwing.

In practice: after catching an exception, you can usually keep making SPICE calls without doing anything special.

Many thrown errors also include structured fields (when available):

- `spiceShort`
- `spiceLong`
- `spiceTrace`

### Global/process state and thread-safety

SPICE has global (or effectively-global) state:

- loaded kernels + the kernel pool
- time conversion defaults (TIMDEF)
- error status/message buffers (cleared automatically on failure, but still global)

Guidelines:

- Treat a `spice` client as a **shared, stateful resource**.
- Prefer an explicit kernel load order and call `spice.raw.kclear()` between independent runs/tests.
- Don’t assume “two clients == two independent SPICE instances” in Node; CSPICE state is process-global and calls are serialized internally.

### Node vs browser kernel I/O (high level)

Kernel loading is where environment differences matter most:

- **Node/native backend:** `raw.furnsh("/abs/or/relative/path")` reads from the OS filesystem.
- **Browser/WASM backend:** you typically load **bytes** into a virtual filesystem path (often under `/kernels/...`).
  - Use `spiceClients.withKernel({ url })` / `withKernels(pack)` for the common case.
  - Or call `kit.loadKernel({ path, bytes })` if you already have the bytes.

### Conventions you should assume everywhere

- **Distance:** km
- **Velocity:** km/s
- **Angles:** radians
- **Time:** ET (seconds past J2000, TDB)
- **Frame names:** strings (e.g. `"J2000"`, `"IAU_EARTH"`)
- **Matrix layout:**
  - `raw.pxform(...)` returns a length-9 array in **row-major** order
  - `kit.frameTransform(...)` returns a `Mat3` with `.rowMajor` and `.colMajor` accessors

## Gotchas

- **State leaks across calls:** kernel load order and global defaults affect results.
- **Async vs sync clients:** `toAsync()` / `toWebWorker()` promisify every method; `toSync()` does not.
- **Some low-level outputs are “poisoned” on error:** APIs that mutate caller-provided handles (cells/windows) may leave them in an undefined state if an exception is thrown — recreate them.
- **Row-major vs column-major:** most 3D/math libraries expect column-major matrices; use `Mat3.colMajor` when integrating.
