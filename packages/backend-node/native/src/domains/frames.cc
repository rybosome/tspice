#include "frames.h"

#include <cmath>
#include <cstdint>
#include <limits>
#include <vector>
#include <string>

#include "../addon_common.h"
#include "../cell_handles.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeFound;
using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::PreviewForError;
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
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling namfrm(\"") + PreviewForError(name) + "\")",
        err);
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
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling cnmfrm(\"") + PreviewForError(centerName) + "\")",
        err);
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

static Napi::Object Frinfo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "frinfo(frameId: number) expects exactly one number argument"));
    return Napi::Object::New(env);
  }

  const int frameId = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  int center = 0;
  int frameClass = 0;
  int classId = 0;
  int found = 0;
  const int code = tspice_frinfo(frameId, &center, &frameClass, &classId, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling frinfo(") + std::to_string(frameId) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("center", Napi::Number::New(env, static_cast<double>(center)));
  result.Set("frameClass", Napi::Number::New(env, static_cast<double>(frameClass)));
  result.Set("classId", Napi::Number::New(env, static_cast<double>(classId)));
  return result;
}

static Napi::Object Ccifrm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ccifrm(frameClass: number, classId: number) expects (number, number)"));
    return Napi::Object::New(env);
  }

  const int frameClass = info[0].As<Napi::Number>().Int32Value();
  const int classId = info[1].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  char frname[tspice_backend_node::kOutMaxBytes];
  int frcode = 0;
  int center = 0;
  int found = 0;
  const int code = tspice_ccifrm(
      frameClass,
      classId,
      &frcode,
      frname,
      (int)sizeof(frname),
      &center,
      &found,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ccifrm", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("frcode", Napi::Number::New(env, static_cast<double>(frcode)));
  result.Set("frname", Napi::String::New(env, frname));
  result.Set("center", Napi::Number::New(env, static_cast<double>(center)));
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

static bool CkwInt(Napi::Env env, const Napi::Value& value, int* out) {
  if (value.IsNumber()) {
    const double d = value.As<Napi::Number>().DoubleValue();
    if (d >= INT32_MIN && d <= INT32_MAX && std::trunc(d) == d) {
      *out = static_cast<int>(d);
      return true;
    }
  }
  ThrowSpiceError(Napi::RangeError::New(env, "Expected a signed 32-bit CK integer"));
  return false;
}

static bool CkwString(Napi::Env env, const Napi::Value& value, std::string* out) {
  if (value.IsString()) {
    *out = value.As<Napi::String>().Utf8Value();
    if (out->size() < INT32_MAX && out->find('\0') == std::string::npos) return true;
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a NUL-free CK string"));
  return false;
}

static Napi::Value Ckopn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "ckopn: invalid argument count"));
    return env.Undefined();
  }
  std::string path;
  if (!CkwString(env, info[0], &path)) return env.Undefined();
  std::string ifname;
  if (!CkwString(env, info[1], &ifname)) return env.Undefined();
  int ncomch = 0;
  if (!CkwInt(env, info[2], &ncomch)) return env.Undefined();
  int out = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_ckopn(path.c_str(), ifname.c_str(), ncomch, &out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling ckopn", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Ckcls(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "ckcls: invalid argument count"));
    return env.Undefined();
  }
  int handle = 0;
  if (!CkwInt(env, info[0], &handle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_ckcls(handle, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling ckcls", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Ckw01(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 9) {
    ThrowSpiceError(Napi::TypeError::New(env, "ckw01: invalid argument count"));
    return env.Undefined();
  }
  int handle = 0;
  if (!CkwInt(env, info[0], &handle)) return env.Undefined();
  if (!info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK beg Number"));
    return env.Undefined();
  }
  const double beg = info[1].As<Napi::Number>().DoubleValue();
  if (!info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK end Number"));
    return env.Undefined();
  }
  const double end = info[2].As<Napi::Number>().DoubleValue();
  int inst = 0;
  if (!CkwInt(env, info[3], &inst)) return env.Undefined();
  std::string ref;
  if (!CkwString(env, info[4], &ref)) return env.Undefined();
  if (!info[5].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK av Boolean"));
    return env.Undefined();
  }
  const bool av = info[5].As<Napi::Boolean>().Value();
  std::string segid;
  if (!CkwString(env, info[6], &segid)) return env.Undefined();
  int n = 0;
  if (!CkwInt(env, info[7], &n)) return env.Undefined();
  if (!info[8].IsTypedArray() || info[8].As<Napi::TypedArray>().TypedArrayType() != napi_float64_array) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected packed Float64Array CK data"));
    return env.Undefined();
  }
  const auto values = info[8].As<Napi::Float64Array>();
  const size_t count = values.ElementLength();
  if (count > 33554432) {
    ThrowSpiceError(Napi::RangeError::New(env, "CK segment exceeds 256 MiB"));
    return env.Undefined();
  }
  double sentinel = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_ckw01(handle, beg, end, inst, ref.c_str(), av, segid.c_str(), n, count ? values.Data() : &sentinel, static_cast<int>(count), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling ckw01", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Ckw02(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 8) {
    ThrowSpiceError(Napi::TypeError::New(env, "ckw02: invalid argument count"));
    return env.Undefined();
  }
  int handle = 0;
  if (!CkwInt(env, info[0], &handle)) return env.Undefined();
  if (!info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK beg Number"));
    return env.Undefined();
  }
  const double beg = info[1].As<Napi::Number>().DoubleValue();
  if (!info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK end Number"));
    return env.Undefined();
  }
  const double end = info[2].As<Napi::Number>().DoubleValue();
  int inst = 0;
  if (!CkwInt(env, info[3], &inst)) return env.Undefined();
  std::string ref;
  if (!CkwString(env, info[4], &ref)) return env.Undefined();
  std::string segid;
  if (!CkwString(env, info[5], &segid)) return env.Undefined();
  int n = 0;
  if (!CkwInt(env, info[6], &n)) return env.Undefined();
  if (!info[7].IsTypedArray() || info[7].As<Napi::TypedArray>().TypedArrayType() != napi_float64_array) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected packed Float64Array CK data"));
    return env.Undefined();
  }
  const auto values = info[7].As<Napi::Float64Array>();
  const size_t count = values.ElementLength();
  if (count > 33554432) {
    ThrowSpiceError(Napi::RangeError::New(env, "CK segment exceeds 256 MiB"));
    return env.Undefined();
  }
  double sentinel = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_ckw02(handle, beg, end, inst, ref.c_str(), segid.c_str(), n, count ? values.Data() : &sentinel, static_cast<int>(count), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling ckw02", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Ckw03(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 10) {
    ThrowSpiceError(Napi::TypeError::New(env, "ckw03: invalid argument count"));
    return env.Undefined();
  }
  int handle = 0;
  if (!CkwInt(env, info[0], &handle)) return env.Undefined();
  if (!info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK beg Number"));
    return env.Undefined();
  }
  const double beg = info[1].As<Napi::Number>().DoubleValue();
  if (!info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK end Number"));
    return env.Undefined();
  }
  const double end = info[2].As<Napi::Number>().DoubleValue();
  int inst = 0;
  if (!CkwInt(env, info[3], &inst)) return env.Undefined();
  std::string ref;
  if (!CkwString(env, info[4], &ref)) return env.Undefined();
  if (!info[5].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK av Boolean"));
    return env.Undefined();
  }
  const bool av = info[5].As<Napi::Boolean>().Value();
  std::string segid;
  if (!CkwString(env, info[6], &segid)) return env.Undefined();
  int n = 0;
  if (!CkwInt(env, info[7], &n)) return env.Undefined();
  int nints = 0;
  if (!CkwInt(env, info[8], &nints)) return env.Undefined();
  if (!info[9].IsTypedArray() || info[9].As<Napi::TypedArray>().TypedArrayType() != napi_float64_array) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected packed Float64Array CK data"));
    return env.Undefined();
  }
  const auto values = info[9].As<Napi::Float64Array>();
  const size_t count = values.ElementLength();
  if (count > 33554432) {
    ThrowSpiceError(Napi::RangeError::New(env, "CK segment exceeds 256 MiB"));
    return env.Undefined();
  }
  double sentinel = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_ckw03(handle, beg, end, inst, ref.c_str(), av, segid.c_str(), n, nints, count ? values.Data() : &sentinel, static_cast<int>(count), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling ckw03", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Ckw05(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 13) {
    ThrowSpiceError(Napi::TypeError::New(env, "ckw05: invalid argument count"));
    return env.Undefined();
  }
  int handle = 0;
  if (!CkwInt(env, info[0], &handle)) return env.Undefined();
  int subtype = 0;
  if (!CkwInt(env, info[1], &subtype)) return env.Undefined();
  int degree = 0;
  if (!CkwInt(env, info[2], &degree)) return env.Undefined();
  if (!info[3].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK beg Number"));
    return env.Undefined();
  }
  const double beg = info[3].As<Napi::Number>().DoubleValue();
  if (!info[4].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK end Number"));
    return env.Undefined();
  }
  const double end = info[4].As<Napi::Number>().DoubleValue();
  int inst = 0;
  if (!CkwInt(env, info[5], &inst)) return env.Undefined();
  std::string ref;
  if (!CkwString(env, info[6], &ref)) return env.Undefined();
  if (!info[7].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK av Boolean"));
    return env.Undefined();
  }
  const bool av = info[7].As<Napi::Boolean>().Value();
  std::string segid;
  if (!CkwString(env, info[8], &segid)) return env.Undefined();
  int n = 0;
  if (!CkwInt(env, info[9], &n)) return env.Undefined();
  int nints = 0;
  if (!CkwInt(env, info[10], &nints)) return env.Undefined();
  if (!info[11].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected CK rate Number"));
    return env.Undefined();
  }
  const double rate = info[11].As<Napi::Number>().DoubleValue();
  if (!info[12].IsTypedArray() || info[12].As<Napi::TypedArray>().TypedArrayType() != napi_float64_array) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected packed Float64Array CK data"));
    return env.Undefined();
  }
  const auto values = info[12].As<Napi::Float64Array>();
  const size_t count = values.ElementLength();
  if (count > 33554432) {
    ThrowSpiceError(Napi::RangeError::New(env, "CK segment exceeds 256 MiB"));
    return env.Undefined();
  }
  double sentinel = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_ckw05(handle, subtype, degree, beg, end, inst, ref.c_str(), av, segid.c_str(), n, nints, rate, count ? values.Data() : &sentinel, static_cast<int>(count), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling ckw05", err);
    return env.Undefined();
  }
  return env.Undefined();
}

// --- CK file query / management --------------------------------------------

static Napi::Number Cklpf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "cklpf(ck: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string ck = info[0].As<Napi::String>().Utf8Value();
  tspice_backend_node::CspiceLock lock;

  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_cklpf(ck.c_str(), &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling cklpf(\"") + PreviewForError(ck) + "\")",
        err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(handle));
}

static void Ckupf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ckupf(handle: number) expects exactly one number argument"));
    return;
  }

  const double d = info[0].As<Napi::Number>().DoubleValue();
  const double hi = (double)std::numeric_limits<int32_t>::max();
  // Validate the numeric value before converting to int32/int to avoid
  // truncation/wrap.
  if (!std::isfinite(d) || std::trunc(d) != d || d < 0.0 || d > hi) {
    ThrowSpiceError(
        Napi::RangeError::New(
            env,
            "ckupf(handle) expects handle to be a finite non-negative 32-bit integer"));
    return;
  }

  const int handle = (int)d;
  tspice_backend_node::CspiceLock lock;

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_ckupf(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ckupf", err);
  }
}

static void Ckobj(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ckobj(ck: string, ids: SpiceIntCell) expects (string, handle)"));
    return;
  }

  const std::string ck = info[0].As<Napi::String>().Utf8Value();
  uint32_t cellHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "ids", &cellHandle)) {
    return;
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t cellPtr = tspice_backend_node::GetCellHandlePtrOrThrow(
      lock,
      env,
      cellHandle,
      SPICE_INT,
      "ckobj(ids)",
      "SpiceIntCell");
  if (env.IsExceptionPending()) return;

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_ckobj(ck.c_str(), cellPtr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ckobj", err);
  }
}

static void Ckcov(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 7 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsBoolean() ||
      !info[3].IsString() || !info[4].IsNumber() || !info[5].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ckcov(ck: string, idcode: number, needav: boolean, level: string, tol: number, timsys: string, cover: SpiceWindow) expects 7 args"));
    return;
  }

  const std::string ck = info[0].As<Napi::String>().Utf8Value();
  const int idcode = info[1].As<Napi::Number>().Int32Value();
  const bool needav = info[2].As<Napi::Boolean>().Value();
  const std::string level = info[3].As<Napi::String>().Utf8Value();
  const double tol = info[4].As<Napi::Number>().DoubleValue();
  const std::string timsys = info[5].As<Napi::String>().Utf8Value();

  uint32_t coverHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[6], "cover", &coverHandle)) {
    return;
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t coverPtr = tspice_backend_node::GetCellHandlePtrOrThrow(
      lock,
      env,
      coverHandle,
      SPICE_DP,
      "ckcov(cover)",
      "SpiceWindow");
  if (env.IsExceptionPending()) return;

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_ckcov(
      ck.c_str(),
      idcode,
      needav ? 1 : 0,
      level.c_str(),
      tol,
      timsys.c_str(),
      coverPtr,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ckcov", err);
  }
}

namespace tspice_backend_node {

void RegisterFrames(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "namfrm", Napi::Function::New(env, Namfrm), __func__)) return;
  if (!SetExportChecked(env, exports, "frmnam", Napi::Function::New(env, Frmnam), __func__)) return;
  if (!SetExportChecked(env, exports, "cidfrm", Napi::Function::New(env, Cidfrm), __func__)) return;
  if (!SetExportChecked(env, exports, "cnmfrm", Napi::Function::New(env, Cnmfrm), __func__)) return;
  if (!SetExportChecked(env, exports, "frinfo", Napi::Function::New(env, Frinfo), __func__)) return;
  if (!SetExportChecked(env, exports, "ccifrm", Napi::Function::New(env, Ccifrm), __func__)) return;

  if (!SetExportChecked(env, exports, "ckopn", Napi::Function::New(env,Ckopn), __func__)) return;
  if (!SetExportChecked(env, exports, "ckcls", Napi::Function::New(env,Ckcls), __func__)) return;
  if (!SetExportChecked(env, exports, "ckw01", Napi::Function::New(env,Ckw01), __func__)) return;
  if (!SetExportChecked(env, exports, "ckw02", Napi::Function::New(env,Ckw02), __func__)) return;
  if (!SetExportChecked(env, exports, "ckw03", Napi::Function::New(env,Ckw03), __func__)) return;
  if (!SetExportChecked(env, exports, "ckw05", Napi::Function::New(env,Ckw05), __func__)) return;
  // CK read-only helpers.
  if (!SetExportChecked(env, exports, "cklpf", Napi::Function::New(env, Cklpf), __func__)) return;
  if (!SetExportChecked(env, exports, "ckupf", Napi::Function::New(env, Ckupf), __func__)) return;
  if (!SetExportChecked(env, exports, "ckobj", Napi::Function::New(env, Ckobj), __func__)) return;
  if (!SetExportChecked(env, exports, "ckcov", Napi::Function::New(env, Ckcov), __func__)) return;

  if (!SetExportChecked(env, exports, "pxform", Napi::Function::New(env, Pxform), __func__)) return;
  if (!SetExportChecked(env, exports, "sxform", Napi::Function::New(env, Sxform), __func__)) return;
}

}  // namespace tspice_backend_node
