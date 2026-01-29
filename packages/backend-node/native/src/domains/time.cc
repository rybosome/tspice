#include "time.h"

#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::ThrowSpiceError;

static Napi::Number Str2et(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "str2et(time: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string time = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[kErrMaxBytes];
  double et = 0.0;
  const int code = tspice_str2et(time.c_str(), &et, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling str2et(\"") + time + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::String Et2utc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsString() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "et2utc(et: number, format: string, prec: number) expects (number, string, number)"));
    return Napi::String::New(env, "");
  }

  const double et = info[0].As<Napi::Number>().DoubleValue();
  const std::string format = info[1].As<Napi::String>().Utf8Value();
  const int prec = info[2].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  char out[kOutMaxBytes];
  const int code =
      tspice_et2utc(et, format.c_str(), prec, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling et2utc", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::String Timout(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "timout(et: number, picture: string) expects (number, string)"));
    return Napi::String::New(env, "");
  }

  const double et = info[0].As<Napi::Number>().DoubleValue();
  const std::string picture = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  char out[kOutMaxBytes];
  const int code = tspice_timout(et, picture.c_str(), out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling timout", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::Number Scs2e(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "scs2e(sc: number, sclkch: string) expects (number, string)"));
    return Napi::Number::New(env, 0);
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const std::string sclkch = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double et = 0.0;
  const int code = tspice_scs2e(sc, sclkch.c_str(), &et, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling scs2e", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::String Sce2s(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sce2s(sc: number, et: number) expects (number, number)"));
    return Napi::String::New(env, "");
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  char out[kOutMaxBytes];
  const int code = tspice_sce2s(sc, et, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sce2s", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

namespace tspice_backend_node {

void RegisterTime(Napi::Env env, Napi::Object exports) {
  exports.Set("str2et", Napi::Function::New(env, Str2et));
  exports.Set("et2utc", Napi::Function::New(env, Et2utc));
  exports.Set("timout", Napi::Function::New(env, Timout));
  exports.Set("scs2e", Napi::Function::New(env, Scs2e));
  exports.Set("sce2s", Napi::Function::New(env, Sce2s));
}

}  // namespace tspice_backend_node
