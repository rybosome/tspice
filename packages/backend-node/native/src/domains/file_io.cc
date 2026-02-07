#include "file_io.h"

#include <string>
#include <cmath>
#include <cstdint>
#include <limits>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNotFound;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static bool ReadDlaDescriptorField(
    Napi::Env env,
    const Napi::Object& obj,
    const char* key,
    int* out) {
  if (!obj.Has(key)) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Missing DLA descriptor field: ") + key));
    return false;
  }

  const Napi::Value value = obj.Get(key);
  if (!value.IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, std::string("Expected DLA descriptor field '") + key + "' to be a number"));
    return false;
  }

  const double d = value.As<Napi::Number>().DoubleValue();
  const double lo = (double)std::numeric_limits<int32_t>::min();
  const double hi = (double)std::numeric_limits<int32_t>::max();
  if (!std::isfinite(d) || std::floor(d) != d || d < lo || d > hi) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        std::string("Expected DLA descriptor field '") + key + "' to be a 32-bit signed integer"));
    return false;
  }

  if (out) {
    *out = (int32_t)d;
  }
  return true;
}

static bool ReadDlaDescriptor(Napi::Env env, const Napi::Value& value, int outDescr8[8]) {
  if (!value.IsObject()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected DLA descriptor to be an object"));
    return false;
  }
  const Napi::Object obj = value.As<Napi::Object>();

  return ReadDlaDescriptorField(env, obj, "bwdptr", &outDescr8[0]) &&
      ReadDlaDescriptorField(env, obj, "fwdptr", &outDescr8[1]) &&
      ReadDlaDescriptorField(env, obj, "ibase", &outDescr8[2]) &&
      ReadDlaDescriptorField(env, obj, "isize", &outDescr8[3]) &&
      ReadDlaDescriptorField(env, obj, "dbase", &outDescr8[4]) &&
      ReadDlaDescriptorField(env, obj, "dsize", &outDescr8[5]) &&
      ReadDlaDescriptorField(env, obj, "cbase", &outDescr8[6]) &&
      ReadDlaDescriptorField(env, obj, "csize", &outDescr8[7]);
}

static Napi::Object MakeDlaDescriptor(Napi::Env env, const int descr8[8]) {
  Napi::Object descr = Napi::Object::New(env);
  descr.Set("bwdptr", Napi::Number::New(env, (double)descr8[0]));
  descr.Set("fwdptr", Napi::Number::New(env, (double)descr8[1]));
  descr.Set("ibase", Napi::Number::New(env, (double)descr8[2]));
  descr.Set("isize", Napi::Number::New(env, (double)descr8[3]));
  descr.Set("dbase", Napi::Number::New(env, (double)descr8[4]));
  descr.Set("dsize", Napi::Number::New(env, (double)descr8[5]));
  descr.Set("cbase", Napi::Number::New(env, (double)descr8[6]));
  descr.Set("csize", Napi::Number::New(env, (double)descr8[7]));
  return descr;
}

static Napi::Boolean Exists(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "exists(path: string) expects exactly one string argument"));
    return Napi::Boolean::New(env, false);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int exists = 0;
  const int code = tspice_exists(path.c_str(), &exists, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling exists(\"") + path + "\")", err);
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, exists != 0);
}

static Napi::Object Getfat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "getfat(path: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char arch[tspice_backend_node::kOutMaxBytes];
  char type[tspice_backend_node::kOutMaxBytes];

  const int code = tspice_getfat(
      path.c_str(),
      arch,
      (int)sizeof(arch),
      type,
      (int)sizeof(type),
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling getfat(\"") + path + "\")", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("arch", Napi::String::New(env, arch));
  result.Set("type", Napi::String::New(env, type));
  return result;
}

static Napi::Number Dafopr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dafopr(path: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_dafopr(path.c_str(), &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dafopr(\"") + path + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static void Dafcls(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dafcls(handle: number) expects exactly one numeric handle"));
    return;
  }

  const int handle = info[0].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_dafcls(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dafcls(handle=") + std::to_string(handle) + ")", err);
  }
}

static void Dafbfs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dafbfs(handle: number) expects exactly one numeric handle"));
    return;
  }

  const int handle = info[0].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_dafbfs(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dafbfs(handle=") + std::to_string(handle) + ")", err);
  }
}

static Napi::Boolean Daffna(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "daffna(handle: number) expects exactly one numeric handle"));
    return Napi::Boolean::New(env, false);
  }

  const int handle = info[0].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int found = 0;
  const int code = tspice_daffna(handle, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling daffna(handle=") + std::to_string(handle) + ")", err);
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, found != 0);
}

static Napi::Number Dasopr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dasopr(path: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_dasopr(path.c_str(), &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dasopr(\"") + path + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static void Dascls(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dascls(handle: number) expects exactly one numeric handle"));
    return;
  }

  const int handle = info[0].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_dascls(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dascls(handle=") + std::to_string(handle) + ")", err);
  }
}

static void Dlacls(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dlacls(handle: number) expects exactly one numeric handle"));
    return;
  }

  const int handle = info[0].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_dlacls(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dlacls(handle=") + std::to_string(handle) + ")", err);
  }
}

static Napi::Number Dlaopn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 4 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString() || !info[3].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "dlaopn(path: string, ftype: string, ifname: string, ncomch: number) expects 3 strings + 1 number"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();
  const std::string ftype = info[1].As<Napi::String>().Utf8Value();
  const std::string ifname = info[2].As<Napi::String>().Utf8Value();
  const int ncomch = info[3].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_dlaopn(
      path.c_str(),
      ftype.c_str(),
      ifname.c_str(),
      ncomch,
      &handle,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dlaopn(\"") + path + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static Napi::Object Dlabfs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dlabfs(handle: number) expects exactly one numeric handle"));
    return Napi::Object::New(env);
  }

  const int handle = info[0].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int descr8[8] = {0};
  int found = 0;
  const int code = tspice_dlabfs(handle, descr8, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dlabfs(handle=") + std::to_string(handle) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("descr", MakeDlaDescriptor(env, descr8));
  return result;
}

static Napi::Object Dlafns(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dlafns(handle: number, descr: object) expects a handle and descriptor"));
    return Napi::Object::New(env);
  }

  const int handle = info[0].As<Napi::Number>().Int32Value();
  int descr8[8] = {0};
  if (!ReadDlaDescriptor(env, info[1], descr8)) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int nextDescr8[8] = {0};
  int found = 0;
  const int code = tspice_dlafns(handle, descr8, nextDescr8, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dlafns(handle=") + std::to_string(handle) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("descr", MakeDlaDescriptor(env, nextDescr8));
  return result;
}

namespace tspice_backend_node {

void RegisterFileIo(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "exists", Napi::Function::New(env, Exists), __func__)) return;
  if (!SetExportChecked(env, exports, "getfat", Napi::Function::New(env, Getfat), __func__)) return;

  if (!SetExportChecked(env, exports, "dafopr", Napi::Function::New(env, Dafopr), __func__)) return;
  if (!SetExportChecked(env, exports, "dafcls", Napi::Function::New(env, Dafcls), __func__)) return;
  if (!SetExportChecked(env, exports, "dafbfs", Napi::Function::New(env, Dafbfs), __func__)) return;
  if (!SetExportChecked(env, exports, "daffna", Napi::Function::New(env, Daffna), __func__)) return;

  if (!SetExportChecked(env, exports, "dasopr", Napi::Function::New(env, Dasopr), __func__)) return;
  if (!SetExportChecked(env, exports, "dascls", Napi::Function::New(env, Dascls), __func__)) return;

  if (!SetExportChecked(env, exports, "dlacls", Napi::Function::New(env, Dlacls), __func__)) return;

  if (!SetExportChecked(env, exports, "dlaopn", Napi::Function::New(env, Dlaopn), __func__)) return;
  if (!SetExportChecked(env, exports, "dlabfs", Napi::Function::New(env, Dlabfs), __func__)) return;
  if (!SetExportChecked(env, exports, "dlafns", Napi::Function::New(env, Dlafns), __func__)) return;
}

}  // namespace tspice_backend_node
