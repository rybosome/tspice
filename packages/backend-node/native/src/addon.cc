#include <napi.h>

#include <string>
#include <unordered_map>

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

static void RegisterDomainChecked(
    Napi::Env env,
    Napi::Object exports,
    const char* name,
    void (*registerFn)(Napi::Env, Napi::Object)) {
  std::unordered_map<std::string, Napi::Value> before;
  {
    const Napi::Array keys = exports.GetPropertyNames();
    before.reserve(keys.Length());

    for (uint32_t i = 0; i < keys.Length(); i++) {
      const Napi::Value k = keys.Get(i);
      if (!k.IsString()) continue;

      const std::string key = k.As<Napi::String>().Utf8Value();
      before.emplace(key, exports.Get(key));
    }
  }

  registerFn(env, exports);
  if (env.IsExceptionPending()) return;

  const Napi::Array afterKeys = exports.GetPropertyNames();
  for (uint32_t i = 0; i < afterKeys.Length(); i++) {
    const Napi::Value k = afterKeys.Get(i);
    if (!k.IsString()) continue;

    const std::string key = k.As<Napi::String>().Utf8Value();
    auto it = before.find(key);
    if (it == before.end()) continue;

    const Napi::Value after = exports.Get(key);
    if (!it->second.StrictEquals(after)) {
      Napi::Error::New(
          env,
          std::string("Duplicate export key '") + key + "' detected while registering " + name)
          .ThrowAsJavaScriptException();
      return;
    }
  }
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  RegisterDomainChecked(env, exports, "RegisterKernels", tspice_backend_node::RegisterKernels);
  if (env.IsExceptionPending()) return exports;

  RegisterDomainChecked(env, exports, "RegisterTime", tspice_backend_node::RegisterTime);
  if (env.IsExceptionPending()) return exports;

  RegisterDomainChecked(env, exports, "RegisterIdsNames", tspice_backend_node::RegisterIdsNames);
  if (env.IsExceptionPending()) return exports;

  RegisterDomainChecked(env, exports, "RegisterFrames", tspice_backend_node::RegisterFrames);
  if (env.IsExceptionPending()) return exports;

  RegisterDomainChecked(env, exports, "RegisterEphemeris", tspice_backend_node::RegisterEphemeris);
  if (env.IsExceptionPending()) return exports;

  RegisterDomainChecked(env, exports, "RegisterGeometry", tspice_backend_node::RegisterGeometry);
  if (env.IsExceptionPending()) return exports;

  RegisterDomainChecked(
      env,
      exports,
      "RegisterCoordsVectors",
      tspice_backend_node::RegisterCoordsVectors);
  if (env.IsExceptionPending()) return exports;

  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
