# Shared C shim + error/handle model

The Node and WASM backends share the same “CSPICE integration semantics” via a shared C shim package:

- Package: `packages/backend-shim-c/`

The shim is the canonical place where we decide:

- how SPICE errors are captured and turned into “JS-shaped” errors
- what an opaque “handle” means for pointer-backed objects (cells/windows)
- which assumptions are process-global (and therefore must be serialized)

## What lives in `packages/backend-shim-c/`

- **Public headers (stable ABI):**
  - `packages/backend-shim-c/include/tspice_backend_shim.h`
- **Internal helpers:**
  - `packages/backend-shim-c/include/tspice_error.h` (small header-only helper for writing error strings)
- **Implementation:**
  - `packages/backend-shim-c/src/errors.c`
  - `packages/backend-shim-c/src/handle_validation.c`
  - `packages/backend-shim-c/src/domains/*.c`

The exported functions follow a consistent naming pattern (`tspice_*`) and are designed to be callable from:

- a Node native addon (C++/N-API)
- an Emscripten module (WASM)

## How the shim is consumed

### Node backend (native addon)

The Node backend compiles the shim directly into the addon.

- Build definition: `packages/backend-node/native/binding.gyp`
  - includes `../../backend-shim-c/src/**/*.c` as sources
  - adds `../../backend-shim-c/include` to include paths

This ensures the Node addon and the WASM module share identical “C-level” semantics.

### WASM backend (Emscripten)

The WASM build includes the shim as a single translation unit:

- `packages/backend-wasm/emscripten/tspice_backend_wasm_wrapper.c`

That file `#include`s the shim `.c` sources directly so the Emscripten build can compile one wrapper while still reusing the shared shim implementation.

## Error model

Every shim function follows the same basic pattern:

- returns `0` on success
- returns non-zero on failure
- writes a NUL-terminated error string into an `err` buffer (`char* err, int errMaxBytes`)

Key pieces:

- `tspice_init_cspice_error_handling_once()` (in `src/errors.c`) configures CSPICE globally:
  - `erract_c("SET", 0, "RETURN")` so SPICE routines return control instead of aborting
  - `errprt_c("SET", 0, "NONE")` so CSPICE doesn’t print directly to stdout/stderr
- When a SPICE call fails, `tspice_get_spice_error_message_and_reset()` captures:
  - `SHORT` message (`getmsg_c("SHORT", ...)`)
  - `LONG` message (`getmsg_c("LONG", ...)`)
  - quick trace (`qcktrc_c(...)`)
  
  …stores them in process-global buffers, and calls `reset_c()`.

Those structured buffers can be retrieved later via:

- `tspice_get_last_error_short()`
- `tspice_get_last_error_long()`
- `tspice_get_last_error_trace()`

This lets higher-level code attach structured error fields without re-parsing a formatted string.

## Handle model (cells/windows)

Some parts of the backend contract expose “handles” that are not CSPICE integer file handles, but opaque references to heap-allocated C structs (notably `SpiceCell` / `SpiceWindow`).

In the shim:

- allocation functions return an opaque numeric handle (a `uintptr_t` cast of the pointer)
- `src/handle_validation.c` maintains a **process-global registry** of live handles
- every use site validates membership to prevent use-after-free

Important constraints:

- the registry is intentionally simple and **not thread-safe**
- callers must serialize access (Node does this with a global mutex; WASM is single-threaded)

## Why this layer matters

Keeping the shim shared is how we keep Node and WASM behavior aligned:

- consistent error capture + reset semantics
- consistent handle validation + “expired handle” failures
- one place to encode process-global assumptions (which would otherwise drift between backends)
