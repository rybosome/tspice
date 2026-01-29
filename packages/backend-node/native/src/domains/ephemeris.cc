#include "ephemeris.h"

#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::ThrowSpiceError;

static Napi::Object Ckgp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 4 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber() ||
      !info[3].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ckgp(inst: number, sclkdp: number, tol: number, ref: string) expects (number, number, number, string)"));
    return Napi::Object::New(env);
  }

  const int inst = info[0].As<Napi::Number>().Int32Value();
  const double sclkdp = info[1].As<Napi::Number>().DoubleValue();
  const double tol = info[2].As<Napi::Number>().DoubleValue();
  const std::string ref = info[3].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double cmat[9] = {0};
  double clkout = 0.0;
  int found = 0;
  const int code =
      tspice_ckgp(inst, sclkdp, tol, ref.c_str(), cmat, &clkout, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ckgp", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("cmat", MakeNumberArray(env, cmat, 9));
  result.Set("clkout", Napi::Number::New(env, clkout));
  return result;
}

static Napi::Object Ckgpav(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 4 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber() ||
      !info[3].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ckgpav(inst: number, sclkdp: number, tol: number, ref: string) expects (number, number, number, string)"));
    return Napi::Object::New(env);
  }

  const int inst = info[0].As<Napi::Number>().Int32Value();
  const double sclkdp = info[1].As<Napi::Number>().DoubleValue();
  const double tol = info[2].As<Napi::Number>().DoubleValue();
  const std::string ref = info[3].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double cmat[9] = {0};
  double av[3] = {0};
  double clkout = 0.0;
  int found = 0;
  const int code = tspice_ckgpav(
      inst,
      sclkdp,
      tol,
      ref.c_str(),
      cmat,
      av,
      &clkout,
      &found,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ckgpav", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("cmat", MakeNumberArray(env, cmat, 9));
  result.Set("av", MakeNumberArray(env, av, 3));
  result.Set("clkout", Napi::Number::New(env, clkout));
  return result;
}

static Napi::Object Spkezr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsString() ||
      !info[3].IsString() || !info[4].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "spkezr(target: string, et: number, ref: string, abcorr: string, observer: string) expects (string, number, string, string, string)"));
    return Napi::Object::New(env);
  }

  const std::string target = info[0].As<Napi::String>().Utf8Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[3].As<Napi::String>().Utf8Value();
  const std::string observer = info[4].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double state[6] = {0};
  double lt = 0.0;
  const int code = tspice_spkezr(
      target.c_str(),
      et,
      ref.c_str(),
      abcorr.c_str(),
      observer.c_str(),
      state,
      &lt,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkezr", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("state", MakeNumberArray(env, state, 6));
  result.Set("lt", Napi::Number::New(env, lt));
  return result;
}

static Napi::Object Spkpos(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsString() ||
      !info[3].IsString() || !info[4].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "spkpos(target: string, et: number, ref: string, abcorr: string, observer: string) expects (string, number, string, string, string)"));
    return Napi::Object::New(env);
  }

  const std::string target = info[0].As<Napi::String>().Utf8Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[3].As<Napi::String>().Utf8Value();
  const std::string observer = info[4].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double pos[3] = {0};
  double lt = 0.0;
  const int code = tspice_spkpos(
      target.c_str(),
      et,
      ref.c_str(),
      abcorr.c_str(),
      observer.c_str(),
      pos,
      &lt,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkpos", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("pos", MakeNumberArray(env, pos, 3));
  result.Set("lt", Napi::Number::New(env, lt));
  return result;
}

namespace tspice_backend_node {

void RegisterEphemeris(Napi::Env env, Napi::Object exports) {
  exports.Set("ckgp", Napi::Function::New(env, Ckgp));
  exports.Set("ckgpav", Napi::Function::New(env, Ckgpav));
  exports.Set("spkezr", Napi::Function::New(env, Spkezr));
  exports.Set("spkpos", Napi::Function::New(env, Spkpos));
}

}  // namespace tspice_backend_node
