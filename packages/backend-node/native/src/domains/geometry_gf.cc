#include "geometry_gf.h"
#include "geometry_text.h"
#include <algorithm>
#include <cmath>
#include <vector>

#include <string>

#include "../addon_common.h"
#include "../cell_handles.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::PreviewForError;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static void Gfsstp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "gfsstp(step: number) expects exactly one number argument"));
    return;
  }

  const double step = info[0].As<Napi::Number>().DoubleValue();

  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_gfsstp(step, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling gfsstp", err);
  }
}

static Napi::Number Gfstep(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "gfstep(time: number) expects exactly one number argument"));
    return Napi::Number::New(env, 0);
  }

  const double time = info[0].As<Napi::Number>().DoubleValue();

  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];
  double step = 0;
  const int code = tspice_gfstep(time, &step, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling gfstep", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, step);
}

static void Gfstol(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "gfstol(value: number) expects exactly one number argument"));
    return;
  }

  const double value = info[0].As<Napi::Number>().DoubleValue();

  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_gfstol(value, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling gfstol", err);
  }
}

static Napi::Number Gfrefn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 4 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsBoolean() || !info[3].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env, "gfrefn(t1: number, t2: number, s1: boolean, s2: boolean) expects (number, number, boolean, boolean)"));
    return Napi::Number::New(env, 0);
  }

  const double t1 = info[0].As<Napi::Number>().DoubleValue();
  const double t2 = info[1].As<Napi::Number>().DoubleValue();
  const bool s1 = info[2].As<Napi::Boolean>().Value();
  const bool s2 = info[3].As<Napi::Boolean>().Value();

  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];
  double t = 0;
  const int code = tspice_gfrefn(t1, t2, s1 ? 1 : 0, s2 ? 1 : 0, &t, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling gfrefn", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, t);
}

static void Gfrepi(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[1].IsString() || !info[2].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "gfrepi(window: SpiceWindow, begmss: string, endmss: string) expects (handle, string, string)"));
    return;
  }

  uint32_t windowHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "window", &windowHandle)) {
    return;
  }

  const std::string begmss = info[1].As<Napi::String>().Utf8Value();
  const std::string endmss = info[2].As<Napi::String>().Utf8Value();

  tspice_backend_node::CspiceLock lock;
  const uintptr_t windowPtr = tspice_backend_node::GetCellHandlePtrOrThrow(
      lock,
      env,
      windowHandle,
      SPICE_DP,
      "gfrepi(window)",
      "SpiceWindow");
  if (env.IsExceptionPending()) return;

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_gfrepi(windowPtr, begmss.c_str(), endmss.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling gfrepi", err);
  }
}

static void Gfrepf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "gfrepf() does not take any arguments"));
    return;
  }

  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_gfrepf(err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling gfrepf", err);
  }
}

static bool VisibilityWindowPointers(const tspice_backend_node::CspiceLock& lock, const Napi::CallbackInfo& info,
                                     size_t index, uintptr_t *cnfine, uintptr_t *result) {
  Napi::Env env = info.Env();
  uint32_t in=0,out=0;
  if (!tspice_backend_node::ReadCellHandleArg(env,info[index],"cnfine",&in) ||
      !tspice_backend_node::ReadCellHandleArg(env,info[index+1],"result",&out)) return false;
  *cnfine=tspice_backend_node::GetCellHandlePtrOrThrow(lock,env,in,SPICE_DP,"visibility(cnfine)","SpiceWindow");
  if (env.IsExceptionPending()) return false;
  *result=tspice_backend_node::GetCellHandlePtrOrThrow(lock,env,out,SPICE_DP,"visibility(result)","SpiceWindow");
  return !env.IsExceptionPending();
}


// JS callbacks are invoked synchronously on the Node thread that owns this call.
// Nested derivatives get their own frame; the toolkit mutex stays held throughout.
struct UserCallbacks {
  Napi::Env env;
  Napi::Function scalar;
  Napi::Function predicate;
  Napi::Value error;
  bool failed = false;
};

static int CallGfFunction(void *context, int predicate, double t, double *out) {
  auto &callbacks = *static_cast<UserCallbacks *>(context);
  if (callbacks.failed) return 1;
  auto env = callbacks.env;
  // Searches can issue millions of callbacks inside one addon invocation.
  Napi::EscapableHandleScope scope(env);
  const auto epoch = Napi::Number::New(env, t);
  const auto value = predicate ? callbacks.predicate.Call({callbacks.scalar,epoch}) : callbacks.scalar.Call({epoch});
  if (env.IsExceptionPending()) {
    napi_value thrown=nullptr;
    napi_get_and_clear_last_exception(env,&thrown);
    callbacks.error=scope.Escape(Napi::Value(env,thrown));
    callbacks.failed=true;
    return 1;
  }
  if (predicate ? !value.IsBoolean() : (!value.IsNumber() || !std::isfinite(value.As<Napi::Number>().DoubleValue()))) {
    callbacks.error=scope.Escape(Napi::TypeError::New(env,predicate?"GF predicate must return a boolean":"GF scalar must return a finite number").Value());
    callbacks.failed=true;
    return 1;
  }
  *out = predicate ? (value.As<Napi::Boolean>().Value() ? 1. : 0.) : value.As<Napi::Number>().DoubleValue();
  return 0;
}
static bool FinishUserCall(UserCallbacks &c, int status, const char *error) {
  if (c.failed) { napi_throw(c.env,c.error); return false; }
  if (status) { ThrowSpiceError(c.env,"CSPICE user-function call failed",error);return false; }
  return true;
}
static Napi::Value Udf(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length()!=2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env,"udf expects a numeric epoch and initial value"));return env.Undefined();
  }
  tspice_backend_node::CspiceLock lock; double out=0; char err[tspice_backend_node::kErrMaxBytes]={0};
  if(tspice_udf(info[0].As<Napi::Number>().DoubleValue(),info[1].As<Napi::Number>().DoubleValue(),&out,err,sizeof(err))) {
    ThrowSpiceError(env,"udf failed",err);return env.Undefined();
  }
  return Napi::Number::New(env,out);
}
static bool ReadDerivative(const Napi::CallbackInfo &info, double &x, double &dx) {
  if (info.Length() != 3 || !info[0].IsFunction() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(info.Env(), "Expected a scalar callback, x and dx"));
    return false;
  }
  x = info[1].As<Napi::Number>().DoubleValue();
  dx = info[2].As<Napi::Number>().DoubleValue();
  return true;
}

static Napi::Value Uddc(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  double x, dx;
  if (!ReadDerivative(info, x, dx)) return env.Undefined();
  auto fn = info[0].As<Napi::Function>();
  UserCallbacks callbacks{env, fn, fn, env.Undefined()};
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int result = 0;
  tspice_backend_node::CspiceLock lock;
  int status = tspice_uddc(CallGfFunction, &callbacks, x, dx, &result, err, sizeof(err));
  if (!FinishUserCall(callbacks, status, err)) return env.Undefined();
  return Napi::Boolean::New(env, result != 0);
}

static Napi::Value Uddf(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  double x, dx;
  if (!ReadDerivative(info, x, dx)) return env.Undefined();
  auto fn = info[0].As<Napi::Function>();
  UserCallbacks callbacks{env, fn, fn, env.Undefined()};
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double result = 0;
  tspice_backend_node::CspiceLock lock;
  int status = tspice_uddf(CallGfFunction, &callbacks, x, dx, &result, err, sizeof(err));
  if (!FinishUserCall(callbacks, status, err)) return env.Undefined();
  return Napi::Number::New(env, result);
}

static bool CheckUserSearch(const Napi::CallbackInfo &info, size_t length, size_t step) {
  if (info.Length() == length && info[0].IsFunction() && info[1].IsFunction() && info[step].IsNumber())
    return true;
  ThrowSpiceError(Napi::TypeError::New(info.Env(), "Expected scalar and predicate callbacks and a numeric step"));
  return false;
}

static void Gfudb(const Napi::CallbackInfo &info) {
  if (!CheckUserSearch(info, 5, 2)) return;
  auto env = info.Env();
  UserCallbacks callbacks{env, info[0].As<Napi::Function>(), info[1].As<Napi::Function>(), env.Undefined()};
  char err[tspice_backend_node::kErrMaxBytes] = {};
  uintptr_t cnfine, result;
  tspice_backend_node::CspiceLock lock;
  if (!VisibilityWindowPointers(lock, info, 3, &cnfine, &result)) return;
  int status = tspice_gfudb(CallGfFunction, &callbacks, info[2].As<Napi::Number>().DoubleValue(),
                            cnfine, result, err, sizeof(err));
  FinishUserCall(callbacks, status, err);
}

static void Gfuds(const Napi::CallbackInfo &info) {
  if (!CheckUserSearch(info, 9, 5)) return;
  auto env = info.Env();
  std::string relate;
  if (!tspice_napi::ReadGeometryString(env, info[2], &relate)) return;
  if (!info[3].IsNumber() || !info[4].IsNumber() || !info[6].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected numeric scalar search bounds and a workspace count"));
    return;
  }
  const double count = info[6].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(count) || std::trunc(count) != count || count < INT32_MIN || count > INT32_MAX) {
    ThrowSpiceError(Napi::RangeError::New(env, "GF workspace count must be a SpiceInt"));
    return;
  }
  UserCallbacks callbacks{env, info[0].As<Napi::Function>(), info[1].As<Napi::Function>(), env.Undefined()};
  char err[tspice_backend_node::kErrMaxBytes] = {};
  uintptr_t cnfine, result;
  tspice_backend_node::CspiceLock lock;
  if (!VisibilityWindowPointers(lock, info, 7, &cnfine, &result)) return;
  int status = tspice_gfuds(CallGfFunction, &callbacks, relate.c_str(), info[3].As<Napi::Number>().DoubleValue(),
                            info[4].As<Napi::Number>().DoubleValue(), info[5].As<Napi::Number>().DoubleValue(),
                            static_cast<int>(count), cnfine, result, err, sizeof(err));
  FinishUserCall(callbacks, status, err);
}

static int CallConfiguredGf(void *context, int slot, const double *values, int count,
    const char *prefix, const char *suffix, double *out) {
  auto &callback = *static_cast<UserCallbacks *>(context);
  if (callback.failed) return 1;
  auto env = callback.env;
  Napi::EscapableHandleScope scope(env);
  auto args = Napi::Array::New(env, slot == 2 ? 3 : count);
  if (slot == 2) {
    auto endpoints = Napi::Array::New(env, count);
    for (int i = 0; i < count; ++i) endpoints.Set(static_cast<uint32_t>(i), Napi::Number::New(env, values[i]));
    args.Set(0u, endpoints);
    args.Set(1u, Napi::String::New(env, prefix));
    args.Set(2u, Napi::String::New(env, suffix));
  } else {
    for (int i = 0; i < count; ++i) args.Set(static_cast<uint32_t>(i), Napi::Number::New(env, values[i]));
  }
  const auto value = callback.scalar.Call({Napi::Number::New(env, slot), args});
  if (env.IsExceptionPending()) {
    napi_value thrown = nullptr;
    napi_get_and_clear_last_exception(env, &thrown);
    callback.error = scope.Escape(Napi::Value(env, thrown));
    callback.failed = true;
    return 1;
  }
  if (!value.IsNumber() || !std::isfinite(value.As<Napi::Number>().DoubleValue())) {
    callback.error = scope.Escape(Napi::TypeError::New(env, "Expected a finite configurable GF callback result").Value());
    callback.failed = true;
    return 1;
  }
  *out = value.As<Napi::Number>().DoubleValue();
  return 0;
}

static bool ReadGfNumber(Napi::Env env, const Napi::Value &value, double *output) {
  if (value.IsNumber()) {
    const double number = value.As<Napi::Number>().DoubleValue();
    if (std::isfinite(number)) { *output = number; return true; }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a finite Geometry Finder number"));
  return false;
}

static bool ReadGfInteger(Napi::Env env, const Napi::Value &value, int *output) {
  double number;
  if (!ReadGfNumber(env, value, &number)) return false;
  if (number < -2147483648. || number > 2147483647. || std::trunc(number) != number) {
    ThrowSpiceError(Napi::RangeError::New(env, "Expected a signed32 Geometry Finder parameter"));
    return false;
  }
  *output = static_cast<int>(number);
  return true;
}

static bool ReadGfFlag(Napi::Env env, const Napi::Value &value, int *output) {
  if (value.IsUndefined()) { *output = 0; return true; }
  if (!value.IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a Geometry Finder boolean flag"));
    return false;
  }
  *output = value.As<Napi::Boolean>().Value();
  return true;
}

static bool ReadConfiguredGf(const Napi::CallbackInfo &info, Napi::Object *search,
    double *tolerance, int *report, int *bail) {
  auto env = info.Env();
  if (info.Length() != 4 || !info[0].IsObject() || !info[3].IsFunction()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a GF search specification, two windows, and a control callback"));
    return false;
  }
  *search = info[0].As<Napi::Object>();
  return ReadGfNumber(env, search->Get("tolerance"), tolerance) &&
      ReadGfFlag(env, search->Get("report"), report) && ReadGfFlag(env, search->Get("bail"), bail);
}

static bool ReadGfTexts(Napi::Object search, const char *const *fields, int count, std::string *out) {
  for (int i = 0; i < count; ++i) {
    if (!tspice_napi::ReadGeometryString(search.Env(), search.Get(fields[i]), out + i)) return false;
  }
  return true;
}

static void Gfevnt(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  Napi::Object search;
  double tolerance, reference, adjustment;
  int report, bail, workspace;
  if (!ReadConfiguredGf(info, &search, &tolerance, &report, &bail) ||
      !ReadGfNumber(env, search.Get("reference"), &reference) ||
      !ReadGfNumber(env, search.Get("adjustment"), &adjustment) ||
      !ReadGfInteger(env, search.Get("workspaceIntervals"), &workspace)) return;
  const char *const text_fields[] = {"quantity", "relation"};
  std::string text[2];
  if (!ReadGfTexts(search, text_fields, 2, text)) return;
  const auto param = search.Get("parameters");
  if (!param.IsArray() || param.As<Napi::Array>().Length() > 128) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid Geometry Finder parameter table"));
    return;
  }
  const auto rows = param.As<Napi::Array>();
  const uint32_t count = rows.Length();
  const auto allocated = std::max(1u, count);
  std::vector<std::string> names(allocated), texts(allocated);
  std::vector<double> reals(allocated);
  std::vector<int> integers(allocated), flags(allocated);
  size_t width = 2;
  for (uint32_t i = 0; i < count; ++i) {
    const auto value = rows.Get(i);
    if (!value.IsObject()) {
      ThrowSpiceError(Napi::TypeError::New(env, "Expected a Geometry Finder parameter row"));
      return;
    }
    const auto row = value.As<Napi::Object>();
    const auto text_value = row.Get("text"), real = row.Get("real"), integer = row.Get("integer");
    if (!tspice_napi::ReadGeometryString(env, row.Get("name"), &names[i]) ||
        (!text_value.IsUndefined() && !tspice_napi::ReadGeometryString(env, text_value, &texts[i])) ||
        (!real.IsUndefined() && !ReadGfNumber(env, real, &reals[i])) ||
        (!integer.IsUndefined() && !ReadGfInteger(env, integer, &integers[i])) ||
        !ReadGfFlag(env, row.Get("logical"), &flags[i])) return;
    width = std::max(width, std::max(names[i].size(), texts[i].size()) + 1);
  }
  if (width > 8192) {
    ThrowSpiceError(Napi::RangeError::New(env, "Geometry Finder parameter row is too long"));
    return;
  }
  std::vector<char> name_column(allocated * width), text_column(allocated * width);
  for (uint32_t i = 0; i < count; ++i) {
    std::copy(names[i].begin(), names[i].end(), name_column.begin() + i * width);
    std::copy(texts[i].begin(), texts[i].end(), text_column.begin() + i * width);
  }
  auto fn = info[3].As<Napi::Function>();
  UserCallbacks callback{env, fn, fn, env.Undefined()};
  tspice_backend_node::CspiceLock lock;
  uintptr_t input = 0, output = 0;
  if (!VisibilityWindowPointers(lock, info, 1, &input, &output)) return;
  char error[tspice_backend_node::kErrMaxBytes] = {};
  const int status = tspice_gfevnt(CallConfiguredGf, &callback, text[0].c_str(),
      static_cast<int>(count), static_cast<int>(width), name_column.data(), text_column.data(),
      reals.data(), integers.data(), flags.data(), text[1].c_str(), reference, tolerance,
      adjustment, workspace, report, bail, input, output, error, sizeof(error));
  FinishUserCall(callback, status, error);
}

static void Gffove(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  Napi::Object search;
  double tolerance;
  int report, bail;
  if (!ReadConfiguredGf(info, &search, &tolerance, &report, &bail)) return;
  const char *const names[] = {"instrument", "shape", "target", "frame", "aberration", "observer"};
  std::string text[6];
  double ray[3];
  if (!ReadGfTexts(search, names, 6, text) ||
      !tspice_backend_node::ReadNumberArrayFixed(env, search.Get("ray"), 3, ray, "ray")) return;
  auto fn = info[3].As<Napi::Function>();
  UserCallbacks callback{env, fn, fn, env.Undefined()};
  tspice_backend_node::CspiceLock lock;
  uintptr_t input = 0, output = 0;
  if (!VisibilityWindowPointers(lock, info, 1, &input, &output)) return;
  char error[tspice_backend_node::kErrMaxBytes] = {};
  const int status = tspice_gffove(CallConfiguredGf, &callback, text[0].c_str(), text[1].c_str(),
      ray, text[2].c_str(), text[3].c_str(), text[4].c_str(), text[5].c_str(),
      tolerance, report, bail, input, output, error, sizeof(error));
  FinishUserCall(callback, status, error);
}

static void Gfocce(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  Napi::Object search;
  double tolerance;
  int report, bail;
  if (!ReadConfiguredGf(info, &search, &tolerance, &report, &bail)) return;
  const char *const names[] = {"occultation", "front", "frontShape", "frontFrame", "back", "backShape", "backFrame", "aberration", "observer"};
  std::string text[9];
  if (!ReadGfTexts(search, names, 9, text)) return;
  auto fn = info[3].As<Napi::Function>();
  UserCallbacks callback{env, fn, fn, env.Undefined()};
  tspice_backend_node::CspiceLock lock;
  uintptr_t input = 0, output = 0;
  if (!VisibilityWindowPointers(lock, info, 1, &input, &output)) return;
  char error[tspice_backend_node::kErrMaxBytes] = {};
  const int status = tspice_gfocce(CallConfiguredGf, &callback, text[0].c_str(), text[1].c_str(),
      text[2].c_str(), text[3].c_str(), text[4].c_str(), text[5].c_str(), text[6].c_str(),
      text[7].c_str(), text[8].c_str(), tolerance, report, bail, input, output, error, sizeof(error));
  FinishUserCall(callback, status, error);
}

static void Gfoclt(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 12 || !info[9].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "gfoclt: invalid argument count or step"));
    return;
  }
  std::string occtyp, front, fshape, fframe, back, bshape, bframe, abcorr,
      obsrvr;
  if (!tspice_napi::ReadGeometryString(env, info[0], &occtyp))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[1], &front))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[2], &fshape))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[3], &fframe))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[4], &back))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[5], &bshape))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[6], &bframe))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[7], &abcorr))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[8], &obsrvr))
    return;
  const double step = info[9].As<Napi::Number>().DoubleValue();
  tspice_backend_node::CspiceLock lock;
  uintptr_t cnfine = 0, result = 0;
  if (!VisibilityWindowPointers(lock, info, 10, &cnfine, &result))
    return;
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  if (tspice_gfoclt(occtyp.c_str(), front.c_str(), fshape.c_str(),
                    fframe.c_str(), back.c_str(), bshape.c_str(),
                    bframe.c_str(), abcorr.c_str(), obsrvr.c_str(), step,
                    cnfine, result, err, sizeof(err)))
    ThrowSpiceError(env, "CSPICE failed while calling gfoclt", err);
}

static void Gfrfov(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 8 || !info[5].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "gfrfov: invalid argument count or step"));
    return;
  }
  std::string inst, rframe, abcorr, obsrvr;
  if (!tspice_napi::ReadGeometryString(env, info[0], &inst))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[2], &rframe))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[3], &abcorr))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[4], &obsrvr))
    return;
  double raydir[3] = {0};
  if (!tspice_backend_node::ReadNumberArrayFixed(env, info[1], 3, raydir,
                                                 "raydir"))
    return;
  const double step = info[5].As<Napi::Number>().DoubleValue();
  tspice_backend_node::CspiceLock lock;
  uintptr_t cnfine = 0, result = 0;
  if (!VisibilityWindowPointers(lock, info, 6, &cnfine, &result))
    return;
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  if (tspice_gfrfov(inst.c_str(), raydir, rframe.c_str(), abcorr.c_str(),
                    obsrvr.c_str(), step, cnfine, result, err, sizeof(err)))
    ThrowSpiceError(env, "CSPICE failed while calling gfrfov", err);
}

static void Gftfov(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 9 || !info[6].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "gftfov: invalid argument count or step"));
    return;
  }
  std::string inst, target, tshape, tframe, abcorr, obsrvr;
  if (!tspice_napi::ReadGeometryString(env, info[0], &inst))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[1], &target))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[2], &tshape))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[3], &tframe))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[4], &abcorr))
    return;
  if (!tspice_napi::ReadGeometryString(env, info[5], &obsrvr))
    return;
  const double step = info[6].As<Napi::Number>().DoubleValue();
  tspice_backend_node::CspiceLock lock;
  uintptr_t cnfine = 0, result = 0;
  if (!VisibilityWindowPointers(lock, info, 7, &cnfine, &result))
    return;
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  if (tspice_gftfov(inst.c_str(), target.c_str(), tshape.c_str(),
                    tframe.c_str(), abcorr.c_str(), obsrvr.c_str(), step,
                    cnfine, result, err, sizeof(err)))
    ThrowSpiceError(env, "CSPICE failed while calling gftfov", err);
}

static void Gfsep(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 15 ||
      !info[0].IsString() || !info[1].IsString() || !info[2].IsString() ||
      !info[3].IsString() || !info[4].IsString() || !info[5].IsString() ||
      !info[6].IsString() || !info[7].IsString() || !info[8].IsString() ||
      !info[9].IsNumber() || !info[10].IsNumber() || !info[11].IsNumber() ||
      !info[12].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "gfsep(targ1, shape1, frame1, targ2, shape2, frame2, abcorr, obsrvr, relate, refval, adjust, step, nintvls, cnfine, result) expects 15 args"));
    return;
  }

  const std::string targ1 = info[0].As<Napi::String>().Utf8Value();
  const std::string shape1 = info[1].As<Napi::String>().Utf8Value();
  const std::string frame1 = info[2].As<Napi::String>().Utf8Value();
  const std::string targ2 = info[3].As<Napi::String>().Utf8Value();
  const std::string shape2 = info[4].As<Napi::String>().Utf8Value();
  const std::string frame2 = info[5].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[6].As<Napi::String>().Utf8Value();
  const std::string obsrvr = info[7].As<Napi::String>().Utf8Value();
  const std::string relate = info[8].As<Napi::String>().Utf8Value();
  const double refval = info[9].As<Napi::Number>().DoubleValue();
  const double adjust = info[10].As<Napi::Number>().DoubleValue();
  const double step = info[11].As<Napi::Number>().DoubleValue();
  const int nintvls = info[12].As<Napi::Number>().Int32Value();

  uint32_t cnfineHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[13], "cnfine", &cnfineHandle)) {
    return;
  }
  uint32_t resultHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[14], "result", &resultHandle)) {
    return;
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t cnfinePtr = tspice_backend_node::GetCellHandlePtrOrThrow(
      lock,
      env,
      cnfineHandle,
      SPICE_DP,
      "gfsep(cnfine)",
      "SpiceWindow");
  if (env.IsExceptionPending()) return;
  const uintptr_t resultPtr = tspice_backend_node::GetCellHandlePtrOrThrow(
      lock,
      env,
      resultHandle,
      SPICE_DP,
      "gfsep(result)",
      "SpiceWindow");
  if (env.IsExceptionPending()) return;

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_gfsep(
      targ1.c_str(),
      shape1.c_str(),
      frame1.c_str(),
      targ2.c_str(),
      shape2.c_str(),
      frame2.c_str(),
      abcorr.c_str(),
      obsrvr.c_str(),
      relate.c_str(),
      refval,
      adjust,
      step,
      nintvls,
      cnfinePtr,
      resultPtr,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling gfsep(") + PreviewForError(targ1) + ", " +
            PreviewForError(targ2) + ")",
        err);
  }
}

static void Gfdist(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 10 ||
      !info[0].IsString() || !info[1].IsString() || !info[2].IsString() || !info[3].IsString() ||
      !info[4].IsNumber() || !info[5].IsNumber() || !info[6].IsNumber() || !info[7].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "gfdist(target, abcorr, obsrvr, relate, refval, adjust, step, nintvls, cnfine, result) expects 10 args"));
    return;
  }

  const std::string target = info[0].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[1].As<Napi::String>().Utf8Value();
  const std::string obsrvr = info[2].As<Napi::String>().Utf8Value();
  const std::string relate = info[3].As<Napi::String>().Utf8Value();
  const double refval = info[4].As<Napi::Number>().DoubleValue();
  const double adjust = info[5].As<Napi::Number>().DoubleValue();
  const double step = info[6].As<Napi::Number>().DoubleValue();
  const int nintvls = info[7].As<Napi::Number>().Int32Value();

  uint32_t cnfineHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[8], "cnfine", &cnfineHandle)) {
    return;
  }
  uint32_t resultHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[9], "result", &resultHandle)) {
    return;
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t cnfinePtr = tspice_backend_node::GetCellHandlePtrOrThrow(
      lock,
      env,
      cnfineHandle,
      SPICE_DP,
      "gfdist(cnfine)",
      "SpiceWindow");
  if (env.IsExceptionPending()) return;
  const uintptr_t resultPtr = tspice_backend_node::GetCellHandlePtrOrThrow(
      lock,
      env,
      resultHandle,
      SPICE_DP,
      "gfdist(result)",
      "SpiceWindow");
  if (env.IsExceptionPending()) return;

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_gfdist(
      target.c_str(),
      abcorr.c_str(),
      obsrvr.c_str(),
      relate.c_str(),
      refval,
      adjust,
      step,
      nintvls,
      cnfinePtr,
      resultPtr,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling gfdist(") + PreviewForError(target) + ")",
        err);
  }
}

namespace tspice_backend_node {

void RegisterGeometryGf(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "gfsstp", Napi::Function::New(env, Gfsstp), __func__)) return;
  if (!SetExportChecked(env, exports, "gfstep", Napi::Function::New(env, Gfstep), __func__)) return;
  if (!SetExportChecked(env, exports, "gfstol", Napi::Function::New(env, Gfstol), __func__)) return;
  if (!SetExportChecked(env, exports, "gfrefn", Napi::Function::New(env, Gfrefn), __func__)) return;
  if (!SetExportChecked(env, exports, "gfrepi", Napi::Function::New(env, Gfrepi), __func__)) return;
  if (!SetExportChecked(env, exports, "gfrepf", Napi::Function::New(env, Gfrepf), __func__)) return;
  if (!SetExportChecked(env, exports, "gfoclt",
                        Napi::Function::New(env, Gfoclt), __func__))
    return;
  if (!SetExportChecked(env, exports, "gfrfov",
                        Napi::Function::New(env, Gfrfov), __func__))
    return;
  if (!SetExportChecked(env, exports, "gftfov",
                        Napi::Function::New(env, Gftfov), __func__))
    return;
  if (!SetExportChecked(env,exports,"udf",Napi::Function::New(env,Udf),__func__)) return;
  if (!SetExportChecked(env,exports,"uddf",Napi::Function::New(env,Uddf),__func__)) return;
  if (!SetExportChecked(env,exports,"uddc",Napi::Function::New(env,Uddc),__func__)) return;
  if (!SetExportChecked(env, exports, "gfevnt", Napi::Function::New(env, Gfevnt), __func__)) return;
  if (!SetExportChecked(env, exports, "gffove", Napi::Function::New(env, Gffove), __func__)) return;
  if (!SetExportChecked(env, exports, "gfocce", Napi::Function::New(env, Gfocce), __func__)) return;
  if (!SetExportChecked(env,exports,"gfudb",Napi::Function::New(env,Gfudb),__func__)) return;
  if (!SetExportChecked(env,exports,"gfuds",Napi::Function::New(env,Gfuds),__func__)) return;
  if (!SetExportChecked(env, exports, "gfsep", Napi::Function::New(env, Gfsep), __func__)) return;
  if (!SetExportChecked(env, exports, "gfdist", Napi::Function::New(env, Gfdist), __func__)) return;
}

}  // namespace tspice_backend_node
