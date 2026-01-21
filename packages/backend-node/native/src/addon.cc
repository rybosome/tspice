#include <napi.h>

#include <mutex>
#include <string>

extern "C" {
#include "tspice_backend_shim.h"
}

// Forces a rebuild/relink when the resolved CSPICE install changes (cache/toolkit bump
// or TSPICE_CSPICE_DIR override).
#include "cspice_stamp.h"

// The value of TSPICE_CSPICE_STAMP is not used at runtime; this exists solely to create a
// compile-time dependency on the generated header so changes to the CSPICE toolkit/config
// trigger a rebuild.
static_assert(sizeof(TSPICE_CSPICE_STAMP) > 0, "TSPICE_CSPICE_STAMP must be non-empty");

static std::mutex g_cspice_mutex;

static Napi::String SpiceVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    Napi::TypeError::New(env, "spiceVersion() does not take any arguments").ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char out[256];
  char err[2048];

  const int rc = tspice_tkvrsn_toolkit(out, (int)sizeof(out), err, (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_tkvrsn_toolkit():\n") + err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("spiceVersion", Napi::Function::New(env, SpiceVersion));
  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
