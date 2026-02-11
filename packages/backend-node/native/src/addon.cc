#include <napi.h>

#include "domains/coords_vectors.h"
#include "domains/error.h"
#include "domains/cells_windows.h"
#include "domains/ephemeris.h"
#include "domains/file_io.h"
#include "domains/frames.h"
#include "domains/geometry.h"
#include "domains/ids_names.h"
#include "domains/dsk.h"
#include "domains/kernels.h"
#include "domains/kernel_pool.h"
#include "domains/time.h"

// Forces a rebuild/relink when the resolved CSPICE install changes (cache/toolkit bump
// or TSPICE_CSPICE_DIR override).
#include "cspice_stamp.h"

// The value of TSPICE_CSPICE_STAMP is not used at runtime; this exists solely to create a
// compile-time dependency on the generated header so changes to the CSPICE toolkit/config
// trigger a rebuild.
static_assert(sizeof(TSPICE_CSPICE_STAMP) > 0, "TSPICE_CSPICE_STAMP must be non-empty");

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  auto registerDomain = [&](void (*fn)(Napi::Env, Napi::Object)) -> bool {
    fn(env, exports);
    return !env.IsExceptionPending();
  };

  if (!registerDomain(tspice_backend_node::RegisterKernels)) return exports;
  if (!registerDomain(tspice_backend_node::RegisterKernelPool)) return exports;
  if (!registerDomain(tspice_backend_node::RegisterTime)) return exports;
  if (!registerDomain(tspice_backend_node::RegisterIdsNames)) return exports;
  if (!registerDomain(tspice_backend_node::RegisterFrames)) return exports;
  if (!registerDomain(tspice_backend_node::RegisterEphemeris)) return exports;
  if (!registerDomain(tspice_backend_node::RegisterGeometry)) return exports;
  if (!registerDomain(tspice_backend_node::RegisterCoordsVectors)) return exports;
  if (!registerDomain(tspice_backend_node::RegisterFileIo)) return exports;
  if (!registerDomain(tspice_backend_node::RegisterError)) return exports;
  if (!registerDomain(tspice_backend_node::RegisterCellsWindows)) return exports;
  if (!registerDomain(tspice_backend_node::RegisterDsk)) return exports;

  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
