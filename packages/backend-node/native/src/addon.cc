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

static Napi::Value Furnsh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "furnsh(path) expects a single string argument").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  const int rc = tspice_furnsh(path.c_str(), err, (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_furnsh(\"") + path + "\"):\n" +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return env.Undefined();
}

static Napi::Value Unload(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "unload(path) expects a single string argument").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  const int rc = tspice_unload(path.c_str(), err, (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_unload(\"") + path + "\"):\n" +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return env.Undefined();
}

static Napi::Number KtotalAll(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    Napi::TypeError::New(env, "__ktotalAll() does not take any arguments").ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  const int count = tspice_ktotal_all(err, (int)sizeof(err));
  if (count < 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_ktotal_all():\n") +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(count));
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("spiceVersion", Napi::Function::New(env, SpiceVersion));
  exports.Set("furnsh", Napi::Function::New(env, Furnsh));
  exports.Set("unload", Napi::Function::New(env, Unload));

  // Internal test helper (not part of the backend contract).
  exports.Set("__ktotalAll", Napi::Function::New(env, KtotalAll));
  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
