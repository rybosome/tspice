#include "ids_names.h"

#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeFound;
using tspice_napi::MakeNotFound;
using tspice_napi::ThrowSpiceError;

static Napi::Object Bodn2c(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "bodn2c(name: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[kErrMaxBytes];
  int codeOut = 0;
  int found = 0;
  const int code = tspice_bodn2c(name.c_str(), &codeOut, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling bodn2c(\"") + name + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  return MakeFound<double>(env, "code", static_cast<double>(codeOut));
}

static Napi::Object Bodc2n(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "bodc2n(code: number) expects exactly one number argument"));
    return Napi::Object::New(env);
  }

  const int codeIn = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[kErrMaxBytes];
  char nameOut[kOutMaxBytes];
  int found = 0;
  const int code = tspice_bodc2n(codeIn, nameOut, (int)sizeof(nameOut), &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling bodc2n(") + std::to_string(codeIn) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  return MakeFound<const char*>(env, "name", nameOut);
}

namespace tspice_backend_node {

void RegisterIdsNames(Napi::Env env, Napi::Object exports) {
  exports.Set("bodn2c", Napi::Function::New(env, Bodn2c));
  exports.Set("bodc2n", Napi::Function::New(env, Bodc2n));
}

}  // namespace tspice_backend_node
