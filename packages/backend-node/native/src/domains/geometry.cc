#include "geometry.h"

#include <cmath>
#include <cstdint>
#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;


constexpr size_t kSurfaceMaxRows = 268435456 / 24;

static bool SurfaceText(const Napi::Value& value, std::string* text) {
  if (!value.IsString()) return false;
  *text = value.As<Napi::String>().Utf8Value();
  return text->size() < 268435456 && text->find('\0') == std::string::npos;
}

static bool SurfaceInt(const Napi::Value& value, int* result) {
  if (!value.IsNumber()) return false;
  const double n = value.As<Napi::Number>().DoubleValue();
  if (!std::isfinite(n) || n != std::trunc(n) || n < INT32_MIN || n > INT32_MAX) return false;
  *result = static_cast<int>(n);
  return true;
}

static bool SurfaceBuffer(const Napi::Value& value, napi_typedarray_type kind, size_t length) {
  if (!value.IsTypedArray()) return false;
  const auto a = value.As<Napi::TypedArray>();
  return a.TypedArrayType() == kind && a.ElementLength() == length;
}

static Napi::Value SurfaceInputError(Napi::Env env) {
  ThrowSpiceError(Napi::TypeError::New(env, "Invalid bounded surface inputs or result buffers"));
  return env.Undefined();
}

static Napi::Value Latsrf(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 7) return SurfaceInputError(env);
  std::string method, target, fixref;
  int npts = 0;
  if (!SurfaceText(info[0], &method) ||
      !SurfaceText(info[1], &target) ||
      !info[2].IsNumber() ||
      !SurfaceText(info[3], &fixref) ||
      !SurfaceInt(info[4], &npts)) return SurfaceInputError(env);
  if (npts < 0 || static_cast<size_t>(npts) > kSurfaceMaxRows) return SurfaceInputError(env);
  const size_t rows = npts > 0 ? npts : 1;
  if (!SurfaceBuffer(info[5], napi_float64_array, rows * 2) ||
      !SurfaceBuffer(info[6], napi_float64_array, rows * 3)) return SurfaceInputError(env);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  tspice_backend_node::CspiceLock lock;
  if (tspice_latsrf(
      method.c_str(), target.c_str(), info[2].As<Napi::Number>().DoubleValue(), fixref.c_str(), npts, info[5].As<Napi::Float64Array>().Data(), info[6].As<Napi::Float64Array>().Data(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling latsrf", err);
  }
  return env.Undefined();
}

static Napi::Value Srfnrm(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 7) return SurfaceInputError(env);
  std::string method, target, fixref;
  int npts = 0;
  if (!SurfaceText(info[0], &method) ||
      !SurfaceText(info[1], &target) ||
      !info[2].IsNumber() ||
      !SurfaceText(info[3], &fixref) ||
      !SurfaceInt(info[4], &npts)) return SurfaceInputError(env);
  if (npts < 0 || static_cast<size_t>(npts) > kSurfaceMaxRows) return SurfaceInputError(env);
  const size_t rows = npts > 0 ? npts : 1;
  if (!SurfaceBuffer(info[5], napi_float64_array, rows * 3) ||
      !SurfaceBuffer(info[6], napi_float64_array, rows * 3)) return SurfaceInputError(env);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  tspice_backend_node::CspiceLock lock;
  if (tspice_srfnrm(
      method.c_str(), target.c_str(), info[2].As<Napi::Number>().DoubleValue(), fixref.c_str(), npts, info[5].As<Napi::Float64Array>().Data(), info[6].As<Napi::Float64Array>().Data(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling srfnrm", err);
  }
  return env.Undefined();
}

static Napi::Value Limbpt(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 17) return SurfaceInputError(env);
  std::string method, target, fixref, abcorr, corloc, observer;
  int ncuts = 0, maxn = 0;
  if (!SurfaceText(info[0], &method) ||
      !SurfaceText(info[1], &target) ||
      !info[2].IsNumber() ||
      !SurfaceText(info[3], &fixref) ||
      !SurfaceText(info[4], &abcorr) ||
      !SurfaceText(info[5], &corloc) ||
      !SurfaceText(info[6], &observer) ||
      !info[8].IsNumber() ||
      !SurfaceInt(info[9], &ncuts) ||
      !info[10].IsNumber() ||
      !info[11].IsNumber() ||
      !SurfaceInt(info[12], &maxn)) return SurfaceInputError(env);
  if (maxn > static_cast<int>(kSurfaceMaxRows)) return SurfaceInputError(env);
  const size_t rows = maxn > 0 ? maxn : 1;
  const size_t counts = ncuts > 0 && ncuts <= maxn ? ncuts : 1;
  if (!SurfaceBuffer(info[7], napi_float64_array, 3) ||
      !SurfaceBuffer(info[13], napi_int32_array, counts) ||
      !SurfaceBuffer(info[14], napi_float64_array, rows * 3) ||
      !SurfaceBuffer(info[15], napi_float64_array, rows) ||
      !SurfaceBuffer(info[16], napi_float64_array, rows * 3)) return SurfaceInputError(env);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  tspice_backend_node::CspiceLock lock;
  if (tspice_limbpt(
      method.c_str(), target.c_str(), info[2].As<Napi::Number>().DoubleValue(), fixref.c_str(), abcorr.c_str(), corloc.c_str(), observer.c_str(), info[7].As<Napi::Float64Array>().Data(), info[8].As<Napi::Number>().DoubleValue(), ncuts, info[10].As<Napi::Number>().DoubleValue(), info[11].As<Napi::Number>().DoubleValue(), maxn, info[13].As<Napi::Int32Array>().Data(), info[14].As<Napi::Float64Array>().Data(), info[15].As<Napi::Float64Array>().Data(), info[16].As<Napi::Float64Array>().Data(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling limbpt", err);
  }
  return env.Undefined();
}

static Napi::Value Termpt(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 18) return SurfaceInputError(env);
  std::string method, ilusrc, target, fixref, abcorr, corloc, observer;
  int ncuts = 0, maxn = 0;
  if (!SurfaceText(info[0], &method) ||
      !SurfaceText(info[1], &ilusrc) ||
      !SurfaceText(info[2], &target) ||
      !info[3].IsNumber() ||
      !SurfaceText(info[4], &fixref) ||
      !SurfaceText(info[5], &abcorr) ||
      !SurfaceText(info[6], &corloc) ||
      !SurfaceText(info[7], &observer) ||
      !info[9].IsNumber() ||
      !SurfaceInt(info[10], &ncuts) ||
      !info[11].IsNumber() ||
      !info[12].IsNumber() ||
      !SurfaceInt(info[13], &maxn)) return SurfaceInputError(env);
  if (maxn > static_cast<int>(kSurfaceMaxRows)) return SurfaceInputError(env);
  const size_t rows = maxn > 0 ? maxn : 1;
  const size_t counts = ncuts > 0 && ncuts <= maxn ? ncuts : 1;
  if (!SurfaceBuffer(info[8], napi_float64_array, 3) ||
      !SurfaceBuffer(info[14], napi_int32_array, counts) ||
      !SurfaceBuffer(info[15], napi_float64_array, rows * 3) ||
      !SurfaceBuffer(info[16], napi_float64_array, rows) ||
      !SurfaceBuffer(info[17], napi_float64_array, rows * 3)) return SurfaceInputError(env);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  tspice_backend_node::CspiceLock lock;
  if (tspice_termpt(
      method.c_str(), ilusrc.c_str(), target.c_str(), info[3].As<Napi::Number>().DoubleValue(), fixref.c_str(), abcorr.c_str(), corloc.c_str(), observer.c_str(), info[8].As<Napi::Float64Array>().Data(), info[9].As<Napi::Number>().DoubleValue(), ncuts, info[11].As<Napi::Number>().DoubleValue(), info[12].As<Napi::Number>().DoubleValue(), maxn, info[14].As<Napi::Int32Array>().Data(), info[15].As<Napi::Float64Array>().Data(), info[16].As<Napi::Float64Array>().Data(), info[17].As<Napi::Float64Array>().Data(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling termpt", err);
  }
  return env.Undefined();
}

static Napi::Object Subpnt(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 6 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber() ||
      !info[3].IsString() || !info[4].IsString() || !info[5].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "subpnt(method: string, target: string, et: number, fixref: string, abcorr: string, observer: string) expects (string, string, number, string, string, string)"));
    return Napi::Object::New(env);
  }

  const std::string method = info[0].As<Napi::String>().Utf8Value();
  const std::string target = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();
  const std::string fixref = info[3].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[4].As<Napi::String>().Utf8Value();
  const std::string observer = info[5].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double spoint[3] = {0};
  double trgepc = 0.0;
  double srfvec[3] = {0};
  const int code = tspice_subpnt(
      method.c_str(),
      target.c_str(),
      et,
      fixref.c_str(),
      abcorr.c_str(),
      observer.c_str(),
      spoint,
      &trgepc,
      srfvec,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling subpnt", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("spoint", MakeNumberArray(env, spoint, 3));
  result.Set("trgepc", Napi::Number::New(env, trgepc));
  result.Set("srfvec", MakeNumberArray(env, srfvec, 3));
  return result;
}

static Napi::Object Subslr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 6 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber() ||
      !info[3].IsString() || !info[4].IsString() || !info[5].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "subslr(method: string, target: string, et: number, fixref: string, abcorr: string, observer: string) expects (string, string, number, string, string, string)"));
    return Napi::Object::New(env);
  }

  const std::string method = info[0].As<Napi::String>().Utf8Value();
  const std::string target = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();
  const std::string fixref = info[3].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[4].As<Napi::String>().Utf8Value();
  const std::string observer = info[5].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double spoint[3] = {0};
  double trgepc = 0.0;
  double srfvec[3] = {0};
  const int code = tspice_subslr(
      method.c_str(),
      target.c_str(),
      et,
      fixref.c_str(),
      abcorr.c_str(),
      observer.c_str(),
      spoint,
      &trgepc,
      srfvec,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling subslr", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("spoint", MakeNumberArray(env, spoint, 3));
  result.Set("trgepc", Napi::Number::New(env, trgepc));
  result.Set("srfvec", MakeNumberArray(env, srfvec, 3));
  return result;
}

static Napi::Object Sincpt(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 8 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber() ||
      !info[3].IsString() || !info[4].IsString() || !info[5].IsString() || !info[6].IsString() ||
      !info[7].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "sincpt(method: string, target: string, et: number, fixref: string, abcorr: string, observer: string, dref: string, dvec: number[3]) expects (string, string, number, string, string, string, string, number[])"));
    return Napi::Object::New(env);
  }

  const std::string method = info[0].As<Napi::String>().Utf8Value();
  const std::string target = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();
  const std::string fixref = info[3].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[4].As<Napi::String>().Utf8Value();
  const std::string observer = info[5].As<Napi::String>().Utf8Value();
  const std::string dref = info[6].As<Napi::String>().Utf8Value();

  double dvec[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[7], dvec, "dvec")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double spoint[3] = {0};
  double trgepc = 0.0;
  double srfvec[3] = {0};
  int found = 0;
  const int code = tspice_sincpt(
      method.c_str(),
      target.c_str(),
      et,
      fixref.c_str(),
      abcorr.c_str(),
      observer.c_str(),
      dref.c_str(),
      dvec,
      spoint,
      &trgepc,
      srfvec,
      &found,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sincpt", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("spoint", MakeNumberArray(env, spoint, 3));
  result.Set("trgepc", Napi::Number::New(env, trgepc));
  result.Set("srfvec", MakeNumberArray(env, srfvec, 3));
  return result;
}

static Napi::Object Ilumin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 7 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber() ||
      !info[3].IsString() || !info[4].IsString() || !info[5].IsString() || !info[6].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ilumin(method: string, target: string, et: number, fixref: string, abcorr: string, observer: string, spoint: number[3]) expects (string, string, number, string, string, string, number[])"));
    return Napi::Object::New(env);
  }

  const std::string method = info[0].As<Napi::String>().Utf8Value();
  const std::string target = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();
  const std::string fixref = info[3].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[4].As<Napi::String>().Utf8Value();
  const std::string observer = info[5].As<Napi::String>().Utf8Value();

  double spoint[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[6], spoint, "spoint")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double trgepc = 0.0;
  double srfvec[3] = {0};
  double phase = 0.0;
  double incdnc = 0.0;
  double emissn = 0.0;
  const int code = tspice_ilumin(
      method.c_str(),
      target.c_str(),
      et,
      fixref.c_str(),
      abcorr.c_str(),
      observer.c_str(),
      spoint,
      &trgepc,
      srfvec,
      &phase,
      &incdnc,
      &emissn,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ilumin", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("trgepc", Napi::Number::New(env, trgepc));
  result.Set("srfvec", MakeNumberArray(env, srfvec, 3));
  result.Set("phase", Napi::Number::New(env, phase));
  result.Set("incdnc", Napi::Number::New(env, incdnc));
  result.Set("emissn", Napi::Number::New(env, emissn));
  return result;
}

static Napi::Object Illumg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 8 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString() ||
      !info[3].IsNumber() || !info[4].IsString() || !info[5].IsString() || !info[6].IsString() ||
      !info[7].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "illumg(method: string, target: string, ilusrc: string, et: number, fixref: string, abcorr: string, observer: string, spoint: number[3]) expects (string, string, string, number, string, string, string, number[])"));
    return Napi::Object::New(env);
  }

  const std::string method = info[0].As<Napi::String>().Utf8Value();
  const std::string target = info[1].As<Napi::String>().Utf8Value();
  const std::string ilusrc = info[2].As<Napi::String>().Utf8Value();
  const double et = info[3].As<Napi::Number>().DoubleValue();
  const std::string fixref = info[4].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[5].As<Napi::String>().Utf8Value();
  const std::string observer = info[6].As<Napi::String>().Utf8Value();

  double spoint[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[7], spoint, "spoint")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double trgepc = 0.0;
  double srfvec[3] = {0};
  double phase = 0.0;
  double incdnc = 0.0;
  double emissn = 0.0;
  const int code = tspice_illumg(
      method.c_str(),
      target.c_str(),
      ilusrc.c_str(),
      et,
      fixref.c_str(),
      abcorr.c_str(),
      observer.c_str(),
      spoint,
      &trgepc,
      srfvec,
      &phase,
      &incdnc,
      &emissn,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling illumg", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("trgepc", Napi::Number::New(env, trgepc));
  result.Set("srfvec", MakeNumberArray(env, srfvec, 3));
  result.Set("phase", Napi::Number::New(env, phase));
  result.Set("incdnc", Napi::Number::New(env, incdnc));
  result.Set("emissn", Napi::Number::New(env, emissn));
  return result;
}

static Napi::Object Illumf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 8 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString() ||
      !info[3].IsNumber() || !info[4].IsString() || !info[5].IsString() || !info[6].IsString() ||
      !info[7].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "illumf(method: string, target: string, ilusrc: string, et: number, fixref: string, abcorr: string, observer: string, spoint: number[3]) expects (string, string, string, number, string, string, string, number[])"));
    return Napi::Object::New(env);
  }

  const std::string method = info[0].As<Napi::String>().Utf8Value();
  const std::string target = info[1].As<Napi::String>().Utf8Value();
  const std::string ilusrc = info[2].As<Napi::String>().Utf8Value();
  const double et = info[3].As<Napi::Number>().DoubleValue();
  const std::string fixref = info[4].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[5].As<Napi::String>().Utf8Value();
  const std::string observer = info[6].As<Napi::String>().Utf8Value();

  double spoint[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[7], spoint, "spoint")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double trgepc = 0.0;
  double srfvec[3] = {0};
  double phase = 0.0;
  double incdnc = 0.0;
  double emissn = 0.0;
  int visibl = 0;
  int lit = 0;
  const int code = tspice_illumf(
      method.c_str(),
      target.c_str(),
      ilusrc.c_str(),
      et,
      fixref.c_str(),
      abcorr.c_str(),
      observer.c_str(),
      spoint,
      &trgepc,
      srfvec,
      &phase,
      &incdnc,
      &emissn,
      &visibl,
      &lit,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling illumf", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("trgepc", Napi::Number::New(env, trgepc));
  result.Set("srfvec", MakeNumberArray(env, srfvec, 3));
  result.Set("phase", Napi::Number::New(env, phase));
  result.Set("incdnc", Napi::Number::New(env, incdnc));
  result.Set("emissn", Napi::Number::New(env, emissn));
  result.Set("visibl", Napi::Boolean::New(env, visibl != 0));
  result.Set("lit", Napi::Boolean::New(env, lit != 0));
  return result;
}

static Napi::Array Nvc2pl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsArray() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "nvc2pl(normal: number[3], konst: number) expects (number[], number)"));
    return Napi::Array::New(env);
  }

  double normal[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], normal, "normal")) {
    return Napi::Array::New(env);
  }
  const double konst = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double plane[4] = {0};
  const int code = tspice_nvc2pl(normal, konst, plane, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling nvc2pl", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, plane, 4);
}

static Napi::Object Pl2nvc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "pl2nvc(plane: number[4]) expects 1 argument"));
    return Napi::Object::New(env);
  }

  double plane[4] = {0};
  if (!tspice_backend_node::ReadNumberArrayFixed(env, info[0], 4, plane, "plane")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double normal[3] = {0};
  double konst = 0.0;
  const int code = tspice_pl2nvc(plane, normal, &konst, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling pl2nvc", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("normal", MakeNumberArray(env, normal, 3));
  result.Set("konst", Napi::Number::New(env, konst));
  return result;
}

static Napi::Number Occult(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 9 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString() ||
      !info[3].IsString() || !info[4].IsString() || !info[5].IsString() || !info[6].IsString() ||
      !info[7].IsString() || !info[8].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "occult(targ1: string, shape1: string, frame1: string, targ2: string, shape2: string, frame2: string, abcorr: string, observer: string, et: number) expects (string, string, string, string, string, string, string, string, number)"));
    return Napi::Number::New(env, 0);
  }

  const std::string targ1 = info[0].As<Napi::String>().Utf8Value();
  const std::string shape1 = info[1].As<Napi::String>().Utf8Value();
  const std::string frame1 = info[2].As<Napi::String>().Utf8Value();
  const std::string targ2 = info[3].As<Napi::String>().Utf8Value();
  const std::string shape2 = info[4].As<Napi::String>().Utf8Value();
  const std::string frame2 = info[5].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[6].As<Napi::String>().Utf8Value();
  const std::string observer = info[7].As<Napi::String>().Utf8Value();
  const double et = info[8].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int ocltid = 0;
  const int code = tspice_occult(
      targ1.c_str(),
      shape1.c_str(),
      frame1.c_str(),
      targ2.c_str(),
      shape2.c_str(),
      frame2.c_str(),
      abcorr.c_str(),
      observer.c_str(),
      et,
      &ocltid,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling occult", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(ocltid));
}

namespace tspice_backend_node {

void RegisterGeometry(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "latsrf", Napi::Function::New(env, Latsrf), __func__)) return;
  if (!SetExportChecked(env, exports, "srfnrm", Napi::Function::New(env, Srfnrm), __func__)) return;
  if (!SetExportChecked(env, exports, "limbpt", Napi::Function::New(env, Limbpt), __func__)) return;
  if (!SetExportChecked(env, exports, "termpt", Napi::Function::New(env, Termpt), __func__)) return;
  if (!SetExportChecked(env, exports, "subpnt", Napi::Function::New(env, Subpnt), __func__)) return;
  if (!SetExportChecked(env, exports, "subslr", Napi::Function::New(env, Subslr), __func__)) return;
  if (!SetExportChecked(env, exports, "sincpt", Napi::Function::New(env, Sincpt), __func__)) return;
  if (!SetExportChecked(env, exports, "ilumin", Napi::Function::New(env, Ilumin), __func__)) return;
  if (!SetExportChecked(env, exports, "illumg", Napi::Function::New(env, Illumg), __func__)) return;
  if (!SetExportChecked(env, exports, "illumf", Napi::Function::New(env, Illumf), __func__)) return;
  if (!SetExportChecked(env, exports, "occult", Napi::Function::New(env, Occult), __func__)) return;
  if (!SetExportChecked(env, exports, "nvc2pl", Napi::Function::New(env, Nvc2pl), __func__)) return;
  if (!SetExportChecked(env, exports, "pl2nvc", Napi::Function::New(env, Pl2nvc), __func__)) return;
}

}  // namespace tspice_backend_node
