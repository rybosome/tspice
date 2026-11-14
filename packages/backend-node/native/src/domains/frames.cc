#include "frames.h"

#include <cmath>
#include <cstdint>
#include <limits>
#include <cstring>
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

static bool CkRecordInt(Napi::Env env, const Napi::Value& value, int* out) {
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

static bool CkRecordString(Napi::Env env, const Napi::Value& value, std::string* out) {
  if (value.IsString()) {
    *out = value.As<Napi::String>().Utf8Value();
    if (out->size() < INT32_MAX && out->find('\0') == std::string::npos) return true;
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a NUL-free CK string"));
  return false;
}

static Napi::Value Ckfrot(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env,"ckfrot: invalid argument count"));
    return env.Undefined();
  }
  int id = 0;
  if (!CkRecordInt(env, info[0], &id)) return env.Undefined();
  if (!info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env,"Expected CK epoch in ET seconds"));
    return env.Undefined();
  }
  const double et = info[1].As<Napi::Number>().DoubleValue();
  double data[9] = {};
  int ref = 0, found = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_ckfrot(id,et,data,&ref,&found,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling ckfrot",err);
    return env.Undefined();
  }
  if (!found) return MakeNotFound(env);
  Napi::Object result = MakeFound<int>(env,"ref",ref);
  result.Set("rotate",MakeNumberArray(env,data,9));
  return result;
}

static Napi::Value Ckfxfm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env,"ckfxfm: invalid argument count"));
    return env.Undefined();
  }
  int id = 0;
  if (!CkRecordInt(env, info[0], &id)) return env.Undefined();
  if (!info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env,"Expected CK epoch in ET seconds"));
    return env.Undefined();
  }
  const double et = info[1].As<Napi::Number>().DoubleValue();
  double data[36] = {};
  int ref = 0, found = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_ckfxfm(id,et,data,&ref,&found,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling ckfxfm",err);
    return env.Undefined();
  }
  if (!found) return MakeNotFound(env);
  Napi::Object result = MakeFound<int>(env,"ref",ref);
  result.Set("xform",MakeNumberArray(env,data,36));
  return result;
}

static Napi::Value Ckgr02(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env,"ckgr02: invalid argument count"));
    return env.Undefined();
  }
  int id = 0;
  if (!CkRecordInt(env, info[0], &id)) return env.Undefined();
  if (!info[1].IsTypedArray() || info[1].As<Napi::TypedArray>().TypedArrayType() != napi_uint8_array ||
      info[1].As<Napi::Uint8Array>().ElementLength() != 40) {
    ThrowSpiceError(Napi::TypeError::New(env,"Expected 40 CK descriptor bytes"));
    return env.Undefined();
  }
  unsigned char bytes[40];
  memcpy(bytes,info[1].As<Napi::Uint8Array>().Data(),sizeof(bytes));
  int recno = 0;
  if (!CkRecordInt(env,info[2],&recno)) return env.Undefined();
  double out[10] = {};
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_ckgr02(id,bytes,sizeof(bytes),recno,out,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling ckgr02",err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out,10);
}

static Napi::Value Ckgr03(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env,"ckgr03: invalid argument count"));
    return env.Undefined();
  }
  int id = 0;
  if (!CkRecordInt(env, info[0], &id)) return env.Undefined();
  if (!info[1].IsTypedArray() || info[1].As<Napi::TypedArray>().TypedArrayType() != napi_uint8_array ||
      info[1].As<Napi::Uint8Array>().ElementLength() != 40) {
    ThrowSpiceError(Napi::TypeError::New(env,"Expected 40 CK descriptor bytes"));
    return env.Undefined();
  }
  unsigned char bytes[40];
  memcpy(bytes,info[1].As<Napi::Uint8Array>().Data(),sizeof(bytes));
  int recno = 0;
  if (!CkRecordInt(env,info[2],&recno)) return env.Undefined();
  double out[8] = {};
  int nwords = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_ckgr03(id,bytes,sizeof(bytes),recno,out,&nwords,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling ckgr03",err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out,nwords);
}

static Napi::Value Ckmeta(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env,"ckmeta: invalid argument count"));
    return env.Undefined();
  }
  int id = 0;
  if (!CkRecordInt(env, info[0], &id)) return env.Undefined();
  std::string meta;
  if (!CkRecordString(env,info[1],&meta)) return env.Undefined();
  int out = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_ckmeta(id,meta.c_str(),&out,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling ckmeta",err);
    return env.Undefined();
  }
  return Napi::Number::New(env,out);
}

static Napi::Value Cknr02(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env,"cknr02: invalid argument count"));
    return env.Undefined();
  }
  int id = 0;
  if (!CkRecordInt(env, info[0], &id)) return env.Undefined();
  if (!info[1].IsTypedArray() || info[1].As<Napi::TypedArray>().TypedArrayType() != napi_uint8_array ||
      info[1].As<Napi::Uint8Array>().ElementLength() != 40) {
    ThrowSpiceError(Napi::TypeError::New(env,"Expected 40 CK descriptor bytes"));
    return env.Undefined();
  }
  unsigned char bytes[40];
  memcpy(bytes,info[1].As<Napi::Uint8Array>().Data(),sizeof(bytes));
  int out = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_cknr02(id,bytes,sizeof(bytes),&out,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling cknr02",err);
    return env.Undefined();
  }
  return Napi::Number::New(env,out);
}

static Napi::Value Cknr03(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env,"cknr03: invalid argument count"));
    return env.Undefined();
  }
  int id = 0;
  if (!CkRecordInt(env, info[0], &id)) return env.Undefined();
  if (!info[1].IsTypedArray() || info[1].As<Napi::TypedArray>().TypedArrayType() != napi_uint8_array ||
      info[1].As<Napi::Uint8Array>().ElementLength() != 40) {
    ThrowSpiceError(Napi::TypeError::New(env,"Expected 40 CK descriptor bytes"));
    return env.Undefined();
  }
  unsigned char bytes[40];
  memcpy(bytes,info[1].As<Napi::Uint8Array>().Data(),sizeof(bytes));
  int out = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_cknr03(id,bytes,sizeof(bytes),&out,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling cknr03",err);
    return env.Undefined();
  }
  return Napi::Number::New(env,out);
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

  if (!SetExportChecked(env,exports,"ckfrot",Napi::Function::New(env,Ckfrot),__func__)) return;
  if (!SetExportChecked(env,exports,"ckfxfm",Napi::Function::New(env,Ckfxfm),__func__)) return;
  if (!SetExportChecked(env,exports,"ckgr02",Napi::Function::New(env,Ckgr02),__func__)) return;
  if (!SetExportChecked(env,exports,"ckgr03",Napi::Function::New(env,Ckgr03),__func__)) return;
  if (!SetExportChecked(env,exports,"ckmeta",Napi::Function::New(env,Ckmeta),__func__)) return;
  if (!SetExportChecked(env,exports,"cknr02",Napi::Function::New(env,Cknr02),__func__)) return;
  if (!SetExportChecked(env,exports,"cknr03",Napi::Function::New(env,Cknr03),__func__)) return;
  // CK read-only helpers.
  if (!SetExportChecked(env, exports, "cklpf", Napi::Function::New(env, Cklpf), __func__)) return;
  if (!SetExportChecked(env, exports, "ckupf", Napi::Function::New(env, Ckupf), __func__)) return;
  if (!SetExportChecked(env, exports, "ckobj", Napi::Function::New(env, Ckobj), __func__)) return;
  if (!SetExportChecked(env, exports, "ckcov", Napi::Function::New(env, Ckcov), __func__)) return;

  if (!SetExportChecked(env, exports, "pxform", Napi::Function::New(env, Pxform), __func__)) return;
  if (!SetExportChecked(env, exports, "sxform", Napi::Function::New(env, Sxform), __func__)) return;
}

}  // namespace tspice_backend_node
