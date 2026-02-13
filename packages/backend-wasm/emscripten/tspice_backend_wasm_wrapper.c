// Thin WASM wrapper.
//
// The canonical CSPICE integration lives in `@rybosome/tspice-backend-shim-c`.
// This file exists so the Emscripten build can compile a single translation
// unit while reusing that shared shim implementation.
//
// When rebuilding the WASM artifacts, compile this file with include paths for:
// - CSPICE headers
// - `packages/backend-shim-c/include`

#include "../../backend-shim-c/src/errors.c"

#include "../../backend-shim-c/src/handle_validation.c"

#include "../../backend-shim-c/src/domains/kernels.c"
#include "../../backend-shim-c/src/domains/kernel_pool.c"
#include "../../backend-shim-c/src/domains/time.c"
#include "../../backend-shim-c/src/domains/ids_names.c"
#include "../../backend-shim-c/src/domains/frames.c"
#include "../../backend-shim-c/src/domains/ephemeris.c"
#include "../../backend-shim-c/src/domains/geometry.c"
#include "../../backend-shim-c/src/domains/coords_vectors.c"
#include "../../backend-shim-c/src/domains/file_io.c"
#include "../../backend-shim-c/src/domains/cells_windows.c"
#include "../../backend-shim-c/src/domains/dsk.c"
