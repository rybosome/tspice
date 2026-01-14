#include <napi.h>

static Napi::String SpiceVersion(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), "cspice-stub");
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("spiceVersion", Napi::Function::New(env, SpiceVersion));
  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
