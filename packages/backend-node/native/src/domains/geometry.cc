#include "geometry.h"

#include <string>
#include <cmath>
#include <limits>
#include <memory>
#include <algorithm>
#include <cstring>
#include <new>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static bool ReadGeometryString(Napi::Env env, const Napi::Value& value, std::string* text) {
  if (!value.IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a string"));
    return false;
  }
  size_t bytes = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &bytes) != napi_ok || bytes >= std::numeric_limits<int>::max()) {
    ThrowSpiceError(Napi::RangeError::New(env, "String exceeds its UTF-8 byte limit"));
    return false;
  }
  const Napi::String input = value.As<Napi::String>();
  // N-API replaces unpaired surrogates when encoding UTF-8. Validate the
  // original UTF-16 units before making the C string.
  const std::u16string units = input.Utf16Value();
  for (size_t i = 0; i < units.size(); i++) {
    const char16_t c = units[i];
    if (c == 0) {
      ThrowSpiceError(Napi::TypeError::New(env, "Input contains an embedded NUL"));
      return false;
    }
    if (c >= 0xd800 && c <= 0xdfff) {
      if (c > 0xdbff || i + 1 == units.size() || units[i+1] < 0xdc00 || units[i+1] > 0xdfff) {
        ThrowSpiceError(Napi::TypeError::New(env, "Input contains an unpaired UTF-16 surrogate"));
        return false;
      }
      i++;
    }
  }
  *text = input.Utf8Value();
  return true;
}

static bool ReadInt(Napi::Env env, const Napi::Value& value, int* out) {
  if (value.IsNumber()) {
    const double n = value.As<Napi::Number>().DoubleValue();
    if (std::isfinite(n) && std::trunc(n) == n && n >= -2147483648.0 && n <= 2147483647.0) {
      *out = static_cast<int>(n);
      return true;
    }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a signed32 integer"));
  return false;
}

static Napi::Value StringBytes(Napi::Env env, const char* data, size_t capacity) {
  const auto end = std::find(data, data + capacity, '\0');
  if (end == data + capacity) {
    ThrowSpiceError(Napi::Error::New(env, "CSPICE string result has no NUL terminator"));
    return env.Undefined();
  }
  const size_t length = static_cast<size_t>(end - data);
  const auto result = Napi::String::New(env, data, length);
  // N-API decodes invalid UTF-8 with replacement. A round trip must preserve
  // every byte, including a leading BOM and trailing whitespace.
  const std::string decoded = result.Utf8Value();
  if (decoded.size() != length || std::memcmp(decoded.data(), data, length) != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "CSPICE string result is not valid UTF-8"));
    return env.Undefined();
  }
  return result;
}

static Napi::Value ReadFov(const Napi::CallbackInfo& info, bool byName) {
  const auto env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected instrument, room and two text capacities"));
    return env.Undefined();
  }
  std::string inst;
  int id = 0, room, shapeLen, frameLen;
  if (byName ? !ReadGeometryString(env, info[0], &inst) : !ReadInt(env, info[0], &id))
    return env.Undefined();
  if (!ReadInt(env, info[1], &room) || !ReadInt(env, info[2], &shapeLen) ||
      !ReadInt(env, info[3], &frameLen))
    return env.Undefined();
  if (room < -715827882) {
    ThrowSpiceError(Napi::RangeError::New(env, "FOV room overflows the toolkit component count"));
    return env.Undefined();
  }
  room = std::min(room, 133334);
  char shape[81] = {}, frame[81] = {}, err[tspice_backend_node::kErrMaxBytes] = {};
  shapeLen = std::min(shapeLen, 81);
  frameLen = std::min(frameLen, 81);
  std::unique_ptr<double[]> bounds(new (std::nothrow) double[3 * std::max(1, room)]{});
  if (!bounds) {
    ThrowSpiceError(env, "FOV output allocation failed");
    return env.Undefined();
  }
  double bore[3] = {};
  int n = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  const int status = byName ? tspice_getfvn(inst.c_str(), room, shapeLen, frameLen, shape, frame,
                                            bore, &n, bounds.get(), err, sizeof(err))
                            : tspice_getfov(id, room, shapeLen, frameLen, shape, frame, bore, &n,
                                            bounds.get(), err, sizeof(err));
  if (status) {
    ThrowSpiceError(env, byName ? "getfvn" : "getfov", err);
    return env.Undefined();
  }
  const auto shapeText = StringBytes(env, shape, sizeof(shape));
  if (env.IsExceptionPending()) return env.Undefined();
  const auto frameText = StringBytes(env, frame, sizeof(frame));
  if (env.IsExceptionPending()) return env.Undefined();
  auto record = Napi::Object::New(env);
  record.Set("shape", shapeText);
  record.Set("frame", frameText);
  record.Set("bsight", MakeNumberArray(env, bore, 3));
  record.Set("n", Napi::Number::New(env, n));
  auto rows = Napi::Array::New(env, n);
  for (int i = 0; i < n; i++) rows.Set(i, MakeNumberArray(env, bounds.get() + 3 * i, 3));
  record.Set("bounds", rows);
  return record;
}
static Napi::Value Getfov(const Napi::CallbackInfo& info) { return ReadFov(info, false); }
static Napi::Value Getfvn(const Napi::CallbackInfo& info) { return ReadFov(info, true); }

static Napi::Value Fovray(const Napi::CallbackInfo& info) {
  const auto env = info.Env();
  if (info.Length() != 6 || !info[5].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "fovray expects its full arguments and a numeric ET"));
    return env.Undefined();
  }
  std::string inst;
  if (!ReadGeometryString(env, info[0], &inst)) return env.Undefined();
  double dir[3];
  if (!tspice_backend_node::ReadVec3(env, info[1], dir, "raydir")) return env.Undefined();
  std::string rframe;
  if (!ReadGeometryString(env, info[2], &rframe)) return env.Undefined();
  std::string abcorr;
  if (!ReadGeometryString(env, info[3], &abcorr)) return env.Undefined();
  std::string observer;
  if (!ReadGeometryString(env, info[4], &observer)) return env.Undefined();
  const double et = info[5].As<Napi::Number>().DoubleValue();
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_fovray(inst.c_str(), dir, rframe.c_str(), abcorr.c_str(), observer.c_str(), et, &out,
                    err, sizeof(err))) {
    ThrowSpiceError(env, "fovray", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Fovtrg(const Napi::CallbackInfo& info) {
  const auto env = info.Env();
  if (info.Length() != 7 || !info[6].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "fovtrg expects its full arguments and a numeric ET"));
    return env.Undefined();
  }
  std::string inst;
  if (!ReadGeometryString(env, info[0], &inst)) return env.Undefined();
  std::string target;
  if (!ReadGeometryString(env, info[1], &target)) return env.Undefined();
  std::string tshape;
  if (!ReadGeometryString(env, info[2], &tshape)) return env.Undefined();
  std::string tframe;
  if (!ReadGeometryString(env, info[3], &tframe)) return env.Undefined();
  std::string abcorr;
  if (!ReadGeometryString(env, info[4], &abcorr)) return env.Undefined();
  std::string observer;
  if (!ReadGeometryString(env, info[5], &observer)) return env.Undefined();
  const double et = info[6].As<Napi::Number>().DoubleValue();
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_fovtrg(inst.c_str(), target.c_str(), tshape.c_str(), tframe.c_str(), abcorr.c_str(),
                    observer.c_str(), et, &out, err, sizeof(err))) {
    ThrowSpiceError(env, "fovtrg", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Phaseq(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 5 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "phaseq() requires its complete argument list and a finite ET"));
    return env.Undefined();
  }
  const double et = info[0].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(et)) {
    ThrowSpiceError(Napi::RangeError::New(env, "ET must be finite"));
    return env.Undefined();
  }
  std::string target;
  if (!ReadGeometryString(env, info[1], &target)) return env.Undefined();
  std::string illmn;
  if (!ReadGeometryString(env, info[2], &illmn)) return env.Undefined();
  std::string observer;
  if (!ReadGeometryString(env, info[3], &observer)) return env.Undefined();
  std::string abcorr;
  if (!ReadGeometryString(env, info[4], &abcorr)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0;
  if (tspice_phaseq(et, target.c_str(), illmn.c_str(), observer.c_str(), abcorr.c_str(), &out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling phaseq", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Lspcn(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "lspcn() requires its complete argument list and a finite ET"));
    return env.Undefined();
  }
  const double et = info[1].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(et)) {
    ThrowSpiceError(Napi::RangeError::New(env, "ET must be finite"));
    return env.Undefined();
  }
  std::string body;
  if (!ReadGeometryString(env, info[0], &body)) return env.Undefined();
  std::string abcorr;
  if (!ReadGeometryString(env, info[2], &abcorr)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0;
  if (tspice_lspcn(body.c_str(), et, abcorr.c_str(), &out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lspcn", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Trgsep(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 9 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "trgsep() requires its complete argument list and a finite ET"));
    return env.Undefined();
  }
  const double et = info[0].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(et)) {
    ThrowSpiceError(Napi::RangeError::New(env, "ET must be finite"));
    return env.Undefined();
  }
  std::string targ1;
  if (!ReadGeometryString(env, info[1], &targ1)) return env.Undefined();
  std::string shape1;
  if (!ReadGeometryString(env, info[2], &shape1)) return env.Undefined();
  std::string frame1;
  if (!ReadGeometryString(env, info[3], &frame1)) return env.Undefined();
  std::string targ2;
  if (!ReadGeometryString(env, info[4], &targ2)) return env.Undefined();
  std::string shape2;
  if (!ReadGeometryString(env, info[5], &shape2)) return env.Undefined();
  std::string frame2;
  if (!ReadGeometryString(env, info[6], &frame2)) return env.Undefined();
  std::string observer;
  if (!ReadGeometryString(env, info[7], &observer)) return env.Undefined();
  std::string abcorr;
  if (!ReadGeometryString(env, info[8], &abcorr)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0;
  if (tspice_trgsep(et, targ1.c_str(), shape1.c_str(), frame1.c_str(), targ2.c_str(), shape2.c_str(), frame2.c_str(), observer.c_str(), abcorr.c_str(), &out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling trgsep", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
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
  if (!SetExportChecked(env, exports, "getfov", Napi::Function::New(env, Getfov), __func__)) return;
  if (!SetExportChecked(env, exports, "getfvn", Napi::Function::New(env, Getfvn), __func__)) return;
  if (!SetExportChecked(env, exports, "fovray", Napi::Function::New(env, Fovray), __func__)) return;
  if (!SetExportChecked(env, exports, "fovtrg", Napi::Function::New(env, Fovtrg), __func__)) return;
  if (!SetExportChecked(env, exports, "phaseq", Napi::Function::New(env, Phaseq), __func__)) return;
  if (!SetExportChecked(env, exports, "lspcn", Napi::Function::New(env, Lspcn), __func__)) return;
  if (!SetExportChecked(env, exports, "trgsep", Napi::Function::New(env, Trgsep), __func__)) return;
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
