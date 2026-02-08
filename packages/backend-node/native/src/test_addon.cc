#include <napi.h>

#include "test_exports.h"

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  tspice_backend_node::RegisterTestExports(env, exports);
  return exports;
}

NODE_API_MODULE(tspice_backend_node_test, Init)
