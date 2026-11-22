#include "frames.h"

#include <cmath>
#include <cstdint>
#include <limits>
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

static bool FrameString(Napi::Env env, const Napi::Value& value, std::string& out) {
  if (value.IsString()) {
    out = value.As<Napi::String>().Utf8Value();
    if (out.find('\0') == std::string::npos && out.size() <= static_cast<size_t>(INT32_MAX)) return true;
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a string representable as a CSPICE C string"));
  return false;
}

static bool FrameDouble(Napi::Env env, const Napi::Value& value, double& out) {
  if (value.IsNumber()) {
    out = value.As<Napi::Number>().DoubleValue();
    if (std::isfinite(out)) return true;
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a finite frame argument"));
  return false;
}

static bool FrameInt(Napi::Env env, const Napi::Value& value, int& out) {
  double number;
  if (!FrameDouble(env, value, number)) return false;
  if (number < INT32_MIN || number > INT32_MAX || number != std::trunc(number)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Expected a signed 32-bit frame argument"));
    return false;
  }
  out = static_cast<int>(number);
  return true;
}

static Napi::Value Bltfrm(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "bltfrm() expects 2 arguments"));
    return env.Undefined();
  }
  int frameClass;
  if (!FrameInt(env, info[0], frameClass)) return env.Undefined();
  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "ids", &handle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];
  const uintptr_t ids = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_INT, "bltfrm(ids)", "SpiceIntCell");
  if (env.IsExceptionPending()) return env.Undefined();
  if (tspice_bltfrm(frameClass, ids, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling bltfrm", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Pxfrm2(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "pxfrm2() expects 4 arguments"));
    return env.Undefined();
  }
  std::string from;
  if (!FrameString(env, info[0], from)) return env.Undefined();
  std::string to;
  if (!FrameString(env, info[1], to)) return env.Undefined();
  double etfrom;
  if (!FrameDouble(env, info[2], etfrom)) return env.Undefined();
  double etto;
  if (!FrameDouble(env, info[3], etto)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0};
  if (tspice_pxfrm2(from.c_str(), to.c_str(), etfrom, etto, out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling pxfrm2", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Tipbod(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "tipbod() expects 3 arguments"));
    return env.Undefined();
  }
  std::string ref;
  if (!FrameString(env, info[0], ref)) return env.Undefined();
  int body;
  if (!FrameInt(env, info[1], body)) return env.Undefined();
  double et;
  if (!FrameDouble(env, info[2], et)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0};
  if (tspice_tipbod(ref.c_str(), body, et, out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling tipbod", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Tisbod(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "tisbod() expects 3 arguments"));
    return env.Undefined();
  }
  std::string ref;
  if (!FrameString(env, info[0], ref)) return env.Undefined();
  int body;
  if (!FrameInt(env, info[1], body)) return env.Undefined();
  double et;
  if (!FrameDouble(env, info[2], et)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];
  double out[36] = {0};
  if (tspice_tisbod(ref.c_str(), body, et, out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling tisbod", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 36);
}

static Napi::Value Tkfram(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "tkfram() expects 1 arguments"));
    return env.Undefined();
  }
  int typeId;
  if (!FrameInt(env, info[0], typeId)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0};
  int frame = 0, found = 0;
  if (tspice_tkfram(typeId, out, &frame, &found, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling tkfram", err);
    return env.Undefined();
  }
  if (!found) return MakeNotFound(env);
  auto result = MakeFound(env, "frame", frame);
  result.Set("rot", MakeNumberArray(env, out, 9));
  return result;
}

static Napi::Value Xfmsta(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "xfmsta() expects 4 arguments"));
    return env.Undefined();
  }
  double state[6];
  if (!info[0].IsArray() || info[0].As<Napi::Array>().Length() != 6) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a six-component state"));
    return env.Undefined();
  }
  const auto array = info[0].As<Napi::Array>();
  for (uint32_t i = 0; i < 6; ++i) {
    const auto value = array.Get(i);
    if (env.IsExceptionPending() || !FrameDouble(env, value, state[i])) return env.Undefined();
  }
  std::string from;
  if (!FrameString(env, info[1], from)) return env.Undefined();
  std::string to;
  if (!FrameString(env, info[2], to)) return env.Undefined();
  std::string body;
  if (!FrameString(env, info[3], body)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];
  double out[6] = {0};
  if (tspice_xfmsta(state, from.c_str(), to.c_str(), body.c_str(), out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling xfmsta", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 6);
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

template <size_t N>
static bool ReadFrameOperand(Napi::Env env, const Napi::Value& source,
                             double (&dest)[N], const char* name) {
  if (!tspice_backend_node::ReadNumberArrayFixed(env, source, N, dest, name)) return false;
  for (double component : dest) {
    if (!std::isfinite(component)) {
      ThrowSpiceError(Napi::RangeError::New(env, std::string(name) + " must contain finite values"));
      return false;
    }
  }
  return true;
}

static bool ReadFrameAxis(Napi::Env env, const Napi::Value& value, int *out) {
  if (value.IsNumber()) {
    const double n = value.As<Napi::Number>().DoubleValue();
    if (n >= INT32_MIN && n <= INT32_MAX && std::trunc(n) == n) {
      *out = static_cast<int>(n);
      return true;
    }
  }
  ThrowSpiceError(Napi::RangeError::New(env, "Expected a signed 32-bit frame axis"));
  return false;
}

static Napi::Value Frame(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "frame: incorrect argument count"));
    return env.Undefined();
  }
  double x[3];
  if (!ReadFrameOperand(env, info[0], x, "frame(x)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double outX[3] = {};
  double outY[3] = {};
  double outZ[3] = {};
  if (tspice_frame(x, outX, outY, outZ, err, sizeof(err))) {
    ThrowSpiceError(env, "frame", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("x", MakeNumberArray(env, outX, 3));
  result.Set("y", MakeNumberArray(env, outY, 3));
  result.Set("z", MakeNumberArray(env, outZ, 3));
  return result;
}

static Napi::Value Twovec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "twovec: incorrect argument count"));
    return env.Undefined();
  }
  double axdef[3];
  if (!ReadFrameOperand(env, info[0], axdef, "twovec(axdef)")) return env.Undefined();
  int indexa;
  if (!ReadFrameAxis(env, info[1], &indexa)) return env.Undefined();
  double plndef[3];
  if (!ReadFrameOperand(env, info[2], plndef, "twovec(plndef)")) return env.Undefined();
  int indexp;
  if (!ReadFrameAxis(env, info[3], &indexp)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double outRotation[9] = {};
  if (tspice_twovec(axdef, indexa, plndef, indexp, outRotation, err, sizeof(err))) {
    ThrowSpiceError(env, "twovec", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, outRotation, 9);
}

static Napi::Value Twovxf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "twovxf: incorrect argument count"));
    return env.Undefined();
  }
  double axdef[6];
  if (!ReadFrameOperand(env, info[0], axdef, "twovxf(axdef)")) return env.Undefined();
  int indexa;
  if (!ReadFrameAxis(env, info[1], &indexa)) return env.Undefined();
  double plndef[6];
  if (!ReadFrameOperand(env, info[2], plndef, "twovxf(plndef)")) return env.Undefined();
  int indexp;
  if (!ReadFrameAxis(env, info[3], &indexp)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double outXform[36] = {};
  if (tspice_twovxf(axdef, indexa, plndef, indexp, outXform, err, sizeof(err))) {
    ThrowSpiceError(env, "twovxf", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, outXform, 36);
}

static Napi::Value Eul2xf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "eul2xf: incorrect argument count"));
    return env.Undefined();
  }
  double eulang[6];
  if (!ReadFrameOperand(env, info[0], eulang, "eul2xf(eulang)")) return env.Undefined();
  int axisa;
  if (!ReadFrameAxis(env, info[1], &axisa)) return env.Undefined();
  int axisb;
  if (!ReadFrameAxis(env, info[2], &axisb)) return env.Undefined();
  int axisc;
  if (!ReadFrameAxis(env, info[3], &axisc)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double outXform[36] = {};
  if (tspice_eul2xf(eulang, axisa, axisb, axisc, outXform, err, sizeof(err))) {
    ThrowSpiceError(env, "eul2xf", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, outXform, 36);
}

static Napi::Value Xf2eul(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "xf2eul: incorrect argument count"));
    return env.Undefined();
  }
  double xform[36];
  if (!ReadFrameOperand(env, info[0], xform, "xf2eul(xform)")) return env.Undefined();
  int axisa;
  if (!ReadFrameAxis(env, info[1], &axisa)) return env.Undefined();
  int axisb;
  if (!ReadFrameAxis(env, info[2], &axisb)) return env.Undefined();
  int axisc;
  if (!ReadFrameAxis(env, info[3], &axisc)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double outEulang[6] = {};
  int outUnique = 0;
  if (tspice_xf2eul(xform, axisa, axisb, axisc, outEulang, &outUnique, err, sizeof(err))) {
    ThrowSpiceError(env, "xf2eul", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("eulang", MakeNumberArray(env, outEulang, 6));
  result.Set("unique", Napi::Boolean::New(env, outUnique != 0));
  return result;
}

static Napi::Value Xf2rav(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "xf2rav: incorrect argument count"));
    return env.Undefined();
  }
  double xform[36];
  if (!ReadFrameOperand(env, info[0], xform, "xf2rav(xform)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double outRot[9] = {};
  double outAv[3] = {};
  if (tspice_xf2rav(xform, outRot, outAv, err, sizeof(err))) {
    ThrowSpiceError(env, "xf2rav", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("rot", MakeNumberArray(env, outRot, 9));
  result.Set("av", MakeNumberArray(env, outAv, 3));
  return result;
}

static Napi::Value Rav2xf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "rav2xf: incorrect argument count"));
    return env.Undefined();
  }
  double rot[9];
  if (!ReadFrameOperand(env, info[0], rot, "rav2xf(rot)")) return env.Undefined();
  double av[3];
  if (!ReadFrameOperand(env, info[1], av, "rav2xf(av)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double outXform[36] = {};
  if (tspice_rav2xf(rot, av, outXform, err, sizeof(err))) {
    ThrowSpiceError(env, "rav2xf", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, outXform, 36);
}

static Napi::Value Invstm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "invstm: incorrect argument count"));
    return env.Undefined();
  }
  double mat[36];
  if (!ReadFrameOperand(env, info[0], mat, "invstm(mat)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double outInvmat[36] = {};
  if (tspice_invstm(mat, outInvmat, err, sizeof(err))) {
    ThrowSpiceError(env, "invstm", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, outInvmat, 36);
}

static Napi::Value Xpose6(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "xpose6: incorrect argument count"));
    return env.Undefined();
  }
  double m1[36];
  if (!ReadFrameOperand(env, info[0], m1, "xpose6(m1)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double outMout[36] = {};
  if (tspice_xpose6(m1, outMout, err, sizeof(err))) {
    ThrowSpiceError(env, "xpose6", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, outMout, 36);
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

  // CK read-only helpers.
  if (!SetExportChecked(env, exports, "cklpf", Napi::Function::New(env, Cklpf), __func__)) return;
  if (!SetExportChecked(env, exports, "ckupf", Napi::Function::New(env, Ckupf), __func__)) return;
  if (!SetExportChecked(env, exports, "ckobj", Napi::Function::New(env, Ckobj), __func__)) return;
  if (!SetExportChecked(env, exports, "ckcov", Napi::Function::New(env, Ckcov), __func__)) return;

  if (!SetExportChecked(env, exports, "bltfrm", Napi::Function::New(env, Bltfrm), __func__)) return;
  if (!SetExportChecked(env, exports, "pxfrm2", Napi::Function::New(env, Pxfrm2), __func__)) return;
  if (!SetExportChecked(env, exports, "tipbod", Napi::Function::New(env, Tipbod), __func__)) return;
  if (!SetExportChecked(env, exports, "tisbod", Napi::Function::New(env, Tisbod), __func__)) return;
  if (!SetExportChecked(env, exports, "tkfram", Napi::Function::New(env, Tkfram), __func__)) return;
  if (!SetExportChecked(env, exports, "xfmsta", Napi::Function::New(env, Xfmsta), __func__)) return;
  if (!SetExportChecked(env, exports, "pxform", Napi::Function::New(env, Pxform), __func__)) return;
  if (!SetExportChecked(env, exports, "frame", Napi::Function::New(env, Frame), __func__)) return;
  if (!SetExportChecked(env, exports, "twovec", Napi::Function::New(env, Twovec), __func__)) return;
  if (!SetExportChecked(env, exports, "twovxf", Napi::Function::New(env, Twovxf), __func__)) return;
  if (!SetExportChecked(env, exports, "eul2xf", Napi::Function::New(env, Eul2xf), __func__)) return;
  if (!SetExportChecked(env, exports, "xf2eul", Napi::Function::New(env, Xf2eul), __func__)) return;
  if (!SetExportChecked(env, exports, "xf2rav", Napi::Function::New(env, Xf2rav), __func__)) return;
  if (!SetExportChecked(env, exports, "rav2xf", Napi::Function::New(env, Rav2xf), __func__)) return;
  if (!SetExportChecked(env, exports, "invstm", Napi::Function::New(env, Invstm), __func__)) return;
  if (!SetExportChecked(env, exports, "xpose6", Napi::Function::New(env, Xpose6), __func__)) return;
  if (!SetExportChecked(env, exports, "sxform", Napi::Function::New(env, Sxform), __func__)) return;
}

}  // namespace tspice_backend_node
