#include "ek.h"

#include <string>
#include <cmath>
#include <cstdint>
#include <limits>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::FixedWidthToJsString;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static bool ReadInt32Checked(Napi::Env env, const Napi::Value& value, const char* what, int32_t* out) {
  const std::string label = (what != nullptr && what[0] != '\0') ? std::string(what) : std::string("value");

  if (!value.IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + label + " to be a number"));
    return false;
  }

  const double d = value.As<Napi::Number>().DoubleValue();
  const double lo = (double)std::numeric_limits<int32_t>::min();
  const double hi = (double)std::numeric_limits<int32_t>::max();
  if (!std::isfinite(d) || std::floor(d) != d || d < lo || d > hi) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + label + " to be a 32-bit signed integer"));
    return false;
  }

  if (out) {
    *out = (int32_t)d;
  }
  return true;
}

namespace tspice_backend_node {

static Napi::Number Ekopr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekopr(path: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_ekopr(path.c_str(), &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling ekopr(\"") + path + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static Napi::Number Ekopw(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekopw(path: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_ekopw(path.c_str(), &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling ekopw(\"") + path + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static Napi::Number Ekopn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ekopn(path: string, ifname: string, ncomch: number) expects (string, string, number)"));
    return Napi::Number::New(env, 0);
  }

  int32_t ncomch = 0;
  if (!ReadInt32Checked(env, info[2], "ncomch", &ncomch)) {
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();
  const std::string ifname = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_ekopn(path.c_str(), ifname.c_str(), ncomch, &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling ekopn(\"") + path + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static void Ekcls(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekcls(handle: number) expects exactly one numeric handle"));
    return;
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_ekcls(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling ekcls(handle=") + std::to_string(handle) + ")", err);
  }
}

static Napi::Number Ekntab(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekntab() does not take any arguments"));
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int n = 0;
  const int code = tspice_ekntab(&n, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ekntab()", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)n);
}

static Napi::String Ektnam(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "ektnam(n: number) expects exactly one numeric index"));
    return Napi::String::New(env, "");
  }

  int32_t n = 0;
  if (!ReadInt32Checked(env, info[0], "n", &n)) {
    return Napi::String::New(env, "");
  }

  if (n < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "Expected n to be >= 0"));
    return Napi::String::New(env, "");
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];

  const int code = tspice_ektnam(n, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling ektnam(n=") + std::to_string(n) + ")", err);
    return Napi::String::New(env, "");
  }

  return FixedWidthToJsString(env, out, sizeof(out));
}

static Napi::Number Eknseg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "eknseg(handle: number) expects exactly one numeric handle"));
    return Napi::Number::New(env, 0);
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int nseg = 0;
  const int code = tspice_eknseg(handle, &nseg, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling eknseg(handle=") + std::to_string(handle) + ")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)nseg);
}

void RegisterEk(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "ekopr", Napi::Function::New(env, Ekopr), __func__)) return;
  if (!SetExportChecked(env, exports, "ekopw", Napi::Function::New(env, Ekopw), __func__)) return;
  if (!SetExportChecked(env, exports, "ekopn", Napi::Function::New(env, Ekopn), __func__)) return;
  if (!SetExportChecked(env, exports, "ekcls", Napi::Function::New(env, Ekcls), __func__)) return;
  if (!SetExportChecked(env, exports, "ekntab", Napi::Function::New(env, Ekntab), __func__)) return;
  if (!SetExportChecked(env, exports, "ektnam", Napi::Function::New(env, Ektnam), __func__)) return;
  if (!SetExportChecked(env, exports, "eknseg", Napi::Function::New(env, Eknseg), __func__)) return;
}

}  // namespace tspice_backend_node
