// Thin WASM wrapper.
//
// The canonical CSPICE integration lives in `@rybosome/tspice-backend-shim-c`.
// This file exists so the Emscripten build can compile a single translation
// unit while reusing that shared shim implementation.
//
// When rebuilding the WASM artifacts, compile this file with include paths for:
// - CSPICE headers
// - `packages/backend-shim-c/include`

#include "../../backend-shim-c/src/tspice_backend_shim.c"
