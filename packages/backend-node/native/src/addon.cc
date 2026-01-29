#include <napi.h>

#include "domains/coords_vectors.h"
#include "domains/ephemeris.h"
#include "domains/frames.h"
#include "domains/geometry.h"
#include "domains/ids_names.h"
#include "domains/kernels.h"
#include "domains/time.h"

// Forces a rebuild/relink when the resolved CSPICE install changes (cache/toolkit bump
// or TSPICE_CSPICE_DIR override).
#include "cspice_stamp.h"

// The value of TSPICE_CSPICE_STAMP is not used at runtime; this exists solely to create a
// compile-time dependency on the generated header so changes to the CSPICE toolkit/config
// trigger a rebuild.
static_assert(sizeof(TSPICE_CSPICE_STAMP) > 0, "TSPICE_CSPICE_STAMP must be non-empty");

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  tspice_backend_node::RegisterKernels(env, exports);
  tspice_backend_node::RegisterTime(env, exports);
  tspice_backend_node::RegisterIdsNames(env, exports);
  tspice_backend_node::RegisterFrames(env, exports);
  tspice_backend_node::RegisterEphemeris(env, exports);
  tspice_backend_node::RegisterGeometry(env, exports);
  tspice_backend_node::RegisterCoordsVectors(env, exports);
  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
