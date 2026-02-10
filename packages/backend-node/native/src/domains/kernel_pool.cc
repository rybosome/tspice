#include "kernel_pool.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <string>
#include <string_view>
#include <vector>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::FixedWidthToJsString;
using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::ReadStringArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

namespace {

constexpr size_t kPoolStringMaxBytes = tspice_backend_node::kOutMaxBytes;
constexpr size_t kPoolNameMaxBytes = 64;

Napi::Array MakeIntArray(Napi::Env env, const int* values, size_t count) {
  Napi::Array arr = Napi::Array::New(env, count);
  for (size_t i = 0; i < count; i++) {
    arr.Set(i, Napi::Number::New(env, static_cast<double>(values[i])));
  }
  return arr;
}

template <size_t N>
inline void CopyToFixedWidth(std::array<char, N>& out, std::string_view value) {
  static_assert(N > 0);
  out.fill('\0');
  const size_t copyLen = std::min(value.size(), N - 1);
  if (copyLen > 0) {
    memcpy(out.data(), value.data(), copyLen);
  }
  out[copyLen] = '\0';
}

}  // namespace

static Napi::Object Gdpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "gdpool(name: string, start: number, room: number) expects (string, number, number)"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  const int start = info[1].As<Napi::Number>().Int32Value();
  const int room = info[2].As<Napi::Number>().Int32Value();

  if (start < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gdpool() expects start >= 0"));
    return Napi::Object::New(env);
  }

  if (room <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gdpool() expects room > 0"));
    return Napi::Object::New(env);
  }

  std::vector<double> values(static_cast<size_t>(room));

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int nOut = 0;
  int found = 0;

  const int code = tspice_gdpool(
      name.c_str(),
      start,
      room,
      &nOut,
      values.data(),
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling gdpool(\"") + name + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  if (nOut < 0) nOut = 0;
  if (nOut > room) nOut = room;

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("values", MakeNumberArray(env, values.data(), static_cast<size_t>(nOut)));
  return result;
}

static Napi::Object Gipool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "gipool(name: string, start: number, room: number) expects (string, number, number)"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  const int start = info[1].As<Napi::Number>().Int32Value();
  const int room = info[2].As<Napi::Number>().Int32Value();

  if (start < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gipool() expects start >= 0"));
    return Napi::Object::New(env);
  }

  if (room <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gipool() expects room > 0"));
    return Napi::Object::New(env);
  }

  std::vector<int> values(static_cast<size_t>(room));

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int nOut = 0;
  int found = 0;

  const int code = tspice_gipool(
      name.c_str(),
      start,
      room,
      &nOut,
      values.data(),
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling gipool(\"") + name + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  if (nOut < 0) nOut = 0;
  if (nOut > room) nOut = room;

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("values", MakeIntArray(env, values.data(), static_cast<size_t>(nOut)));
  return result;
}

static Napi::Object Gcpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "gcpool(name: string, start: number, room: number) expects (string, number, number)"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  const int start = info[1].As<Napi::Number>().Int32Value();
  const int room = info[2].As<Napi::Number>().Int32Value();

  if (start < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gcpool() expects start >= 0"));
    return Napi::Object::New(env);
  }

  if (room <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gcpool() expects room > 0"));
    return Napi::Object::New(env);
  }

  // Fixed-width 2D buffer: room x kPoolStringMaxBytes.
  std::vector<std::array<char, kPoolStringMaxBytes>> cvals(static_cast<size_t>(room));

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int nOut = 0;
  int found = 0;

  const int code = tspice_gcpool(
      name.c_str(),
      start,
      room,
      (int)kPoolStringMaxBytes,
      &nOut,
      cvals.data(),
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling gcpool(\"") + name + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  if (nOut < 0) nOut = 0;
  if (nOut > room) nOut = room;

  Napi::Array values = Napi::Array::New(env, static_cast<size_t>(nOut));
  for (int i = 0; i < nOut; i++) {
    values.Set(static_cast<uint32_t>(i), FixedWidthToJsString(env, cvals[(size_t)i].data(), kPoolStringMaxBytes));
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("values", values);
  return result;
}

static Napi::Object Gnpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "gnpool(template: string, start: number, room: number) expects (string, number, number)"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  const int start = info[1].As<Napi::Number>().Int32Value();
  const int room = info[2].As<Napi::Number>().Int32Value();

  if (start < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gnpool() expects start >= 0"));
    return Napi::Object::New(env);
  }

  if (room <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gnpool() expects room > 0"));
    return Napi::Object::New(env);
  }

  // Fixed-width 2D buffer: room x kPoolNameMaxBytes.
  std::vector<std::array<char, kPoolNameMaxBytes>> cvals(static_cast<size_t>(room));

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int nOut = 0;
  int found = 0;

  const int code = tspice_gnpool(
      name.c_str(),
      start,
      room,
      (int)kPoolNameMaxBytes,
      &nOut,
      cvals.data(),
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling gnpool(\"") + name + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  if (nOut < 0) nOut = 0;
  if (nOut > room) nOut = room;

  Napi::Array values = Napi::Array::New(env, static_cast<size_t>(nOut));
  for (int i = 0; i < nOut; i++) {
    values.Set(static_cast<uint32_t>(i), FixedWidthToJsString(env, cvals[(size_t)i].data(), kPoolNameMaxBytes));
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("values", values);
  return result;
}

static Napi::Object Dtpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dtpool(name: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int found = 0;
  int nOut = 0;
  char typeOut[2] = {'X', '\0'};

  const int code = tspice_dtpool(
      name.c_str(),
      &found,
      &nOut,
      typeOut,
      (int)sizeof(typeOut),
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dtpool(\"") + name + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  const char t = typeOut[0];
  if (t != 'C' && t != 'N') {
    ThrowSpiceError(Napi::Error::New(env, "dtpool() returned unexpected type"));
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("n", Napi::Number::New(env, static_cast<double>(nOut)));
  result.Set("type", Napi::String::New(env, std::string(1, t)));
  return result;
}

static void Pdpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "pdpool(name: string, values: number[]) expects (string, number[])"));
    return;
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  Napi::Array arr = info[1].As<Napi::Array>();

  const uint32_t n = arr.Length();
  std::vector<double> values;
  values.reserve(n);

  for (uint32_t i = 0; i < n; i++) {
    const Napi::Value v = arr.Get(i);
    if (!v.IsNumber()) {
      ThrowSpiceError(Napi::TypeError::New(env, "pdpool values must contain only numbers"));
      return;
    }
    const double d = v.As<Napi::Number>().DoubleValue();
    if (!std::isfinite(d)) {
      ThrowSpiceError(Napi::RangeError::New(env, "pdpool(): values must contain only finite numbers"));
      return;
    }
    values.push_back(d);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_pdpool(name.c_str(), (int)values.size(), values.data(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling pdpool(\"") + name + "\")", err);
  }
}

static void Pipool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "pipool(name: string, values: number[]) expects (string, number[])"));
    return;
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  Napi::Array arr = info[1].As<Napi::Array>();

  const uint32_t n = arr.Length();
  std::vector<int> values;
  values.reserve(n);

  for (uint32_t i = 0; i < n; i++) {
    const Napi::Value v = arr.Get(i);
    if (!v.IsNumber()) {
      ThrowSpiceError(Napi::TypeError::New(env, "pipool values must contain only numbers"));
      return;
    }
    const double d = v.As<Napi::Number>().DoubleValue();
    const bool isInteger = std::isfinite(d) && std::trunc(d) == d;
    // Equivalent to JS `Number.isSafeInteger` for values that matter here.
    const bool isSafeInteger = isInteger && std::fabs(d) <= 9007199254740991.0;  // 2^53 - 1

    if (!isSafeInteger) {
      ThrowSpiceError(Napi::TypeError::New(
          env,
          std::string("pipool(): values[") + std::to_string(i) + "] must be a safe integer"));
      return;
    }

    if (d < -2147483648.0 || d > 2147483647.0) {
      ThrowSpiceError(Napi::RangeError::New(
          env,
          std::string("pipool(): values[") + std::to_string(i) + "] must be a 32-bit signed integer"));
      return;
    }

    values.push_back(static_cast<int>(d));
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_pipool(name.c_str(), (int)values.size(), values.data(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling pipool(\"") + name + "\")", err);
  }
}

static void Pcpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "pcpool(name: string, values: string[]) expects (string, string[])"));
    return;
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  tspice_napi::JsStringArrayArg values;
  if (!ReadStringArray(env, info[1], &values, "values")) {
    return;
  }

  // Fixed-width 2D buffer: n x kPoolStringMaxBytes.
  std::vector<std::array<char, kPoolStringMaxBytes>> cvals(values.values.size());
  for (size_t i = 0; i < values.values.size(); i++) {
    CopyToFixedWidth(cvals[i], values.values[i]);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_pcpool(
      name.c_str(),
      (int)cvals.size(),
      (int)kPoolStringMaxBytes,
      cvals.data(),
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling pcpool(\"") + name + "\")", err);
  }
}

static void Swpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "swpool(agent: string, names: string[]) expects (string, string[])"));
    return;
  }

  const std::string agent = info[0].As<Napi::String>().Utf8Value();

  tspice_napi::JsStringArrayArg names;
  if (!ReadStringArray(env, info[1], &names, "names")) {
    return;
  }

  // Fixed-width 2D buffer: nnames x kPoolNameMaxBytes.
  std::vector<std::array<char, kPoolNameMaxBytes>> namesBuf(names.values.size());
  for (size_t i = 0; i < names.values.size(); i++) {
    CopyToFixedWidth(namesBuf[i], names.values[i]);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_swpool(
      agent.c_str(),
      (int)namesBuf.size(),
      (int)kPoolNameMaxBytes,
      namesBuf.data(),
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling swpool(\"") + agent + "\")", err);
  }
}

static Napi::Boolean Cvpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "cvpool(agent: string) expects exactly one string argument"));
    return Napi::Boolean::New(env, false);
  }

  const std::string agent = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int update = 0;
  const int code = tspice_cvpool(agent.c_str(), &update, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling cvpool(\"") + agent + "\")", err);
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, update != 0);
}

static Napi::Boolean Expool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "expool(name: string) expects exactly one string argument"));
    return Napi::Boolean::New(env, false);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int found = 0;
  const int code = tspice_expool(name.c_str(), &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling expool(\"") + name + "\")", err);
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, found != 0);
}

namespace tspice_backend_node {

void RegisterKernelPool(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "gdpool", Napi::Function::New(env, Gdpool), __func__)) return;
  if (!SetExportChecked(env, exports, "gipool", Napi::Function::New(env, Gipool), __func__)) return;
  if (!SetExportChecked(env, exports, "gcpool", Napi::Function::New(env, Gcpool), __func__)) return;
  if (!SetExportChecked(env, exports, "gnpool", Napi::Function::New(env, Gnpool), __func__)) return;
  if (!SetExportChecked(env, exports, "dtpool", Napi::Function::New(env, Dtpool), __func__)) return;

  if (!SetExportChecked(env, exports, "pdpool", Napi::Function::New(env, Pdpool), __func__)) return;
  if (!SetExportChecked(env, exports, "pipool", Napi::Function::New(env, Pipool), __func__)) return;
  if (!SetExportChecked(env, exports, "pcpool", Napi::Function::New(env, Pcpool), __func__)) return;

  if (!SetExportChecked(env, exports, "swpool", Napi::Function::New(env, Swpool), __func__)) return;
  if (!SetExportChecked(env, exports, "cvpool", Napi::Function::New(env, Cvpool), __func__)) return;
  if (!SetExportChecked(env, exports, "expool", Napi::Function::New(env, Expool), __func__)) return;
}

}  // namespace tspice_backend_node
