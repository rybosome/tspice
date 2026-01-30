#include "frames.h"

#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeFound;
using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static Napi::Object Namfrm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "namfrm(name: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  int codeOut = 0;
  int found = 0;
  const int code = tspice_namfrm(name.c_str(), &codeOut, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling namfrm(\"") + name + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  return MakeFound<double>(env, "code", static_cast<double>(codeOut));
}

static Napi::Object Frmnam(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "frmnam(code: number) expects exactly one number argument"));
    return Napi::Object::New(env);
  }

  const int codeIn = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  char nameOut[tspice_backend_node::kOutMaxBytes];
  int found = 0;
  const int code = tspice_frmnam(codeIn, nameOut, (int)sizeof(nameOut), &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling frmnam(") + std::to_string(codeIn) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  return MakeFound<const char*>(env, "name", nameOut);
}

static Napi::Object Cidfrm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "cidfrm(center: number) expects exactly one number argument"));
    return Napi::Object::New(env);
  }

  const int center = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  char frname[tspice_backend_node::kOutMaxBytes];
  int frcode = 0;
  int found = 0;
  const int code = tspice_cidfrm(center, &frcode, frname, (int)sizeof(frname), &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling cidfrm(") + std::to_string(center) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("frcode", Napi::Number::New(env, static_cast<double>(frcode)));
  result.Set("frname", Napi::String::New(env, frname));
  return result;
}

static Napi::Object Cnmfrm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "cnmfrm(centerName: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string centerName = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  char frname[tspice_backend_node::kOutMaxBytes];
  int frcode = 0;
  int found = 0;
  const int code = tspice_cnmfrm(
      centerName.c_str(),
      &frcode,
      frname,
      (int)sizeof(frname),
      &found,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling cnmfrm(\"") + centerName + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("frcode", Napi::Number::New(env, static_cast<double>(frcode)));
  result.Set("frname", Napi::String::New(env, frname));
  return result;
}

static Napi::Array Pxform(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "pxform(from: string, to: string, et: number) expects (string, string, number)"));
    return Napi::Array::New(env);
  }

  const std::string from = info[0].As<Napi::String>().Utf8Value();
  const std::string to = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double m[9] = {0};
  const int code = tspice_pxform(from.c_str(), to.c_str(), et, m, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling pxform", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, m, 9);
}

static Napi::Array Sxform(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "sxform(from: string, to: string, et: number) expects (string, string, number)"));
    return Napi::Array::New(env);
  }

  const std::string from = info[0].As<Napi::String>().Utf8Value();
  const std::string to = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double m[36] = {0};
  const int code = tspice_sxform(from.c_str(), to.c_str(), et, m, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sxform", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, m, 36);
}

namespace tspice_backend_node {

void RegisterFrames(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "namfrm", Napi::Function::New(env, Namfrm), __func__)) return;
  if (!SetExportChecked(env, exports, "frmnam", Napi::Function::New(env, Frmnam), __func__)) return;
  if (!SetExportChecked(env, exports, "cidfrm", Napi::Function::New(env, Cidfrm), __func__)) return;
  if (!SetExportChecked(env, exports, "cnmfrm", Napi::Function::New(env, Cnmfrm), __func__)) return;
  if (!SetExportChecked(env, exports, "pxform", Napi::Function::New(env, Pxform), __func__)) return;
  if (!SetExportChecked(env, exports, "sxform", Napi::Function::New(env, Sxform), __func__)) return;
}

}  // namespace tspice_backend_node
