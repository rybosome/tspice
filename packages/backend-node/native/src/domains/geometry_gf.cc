#include "geometry_gf.h"

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
  if (!SetExportChecked(env, exports, "gfsep", Napi::Function::New(env, Gfsep), __func__)) return;
  if (!SetExportChecked(env, exports, "gfdist", Napi::Function::New(env, Gfdist), __func__)) return;
}

}  // namespace tspice_backend_node
