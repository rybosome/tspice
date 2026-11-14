#include "geometry.h"

#include <string>
#include <cmath>
#include <limits>

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

static bool LegacyStorage(const Napi::Value& value, size_t words) {
  if (!value.IsTypedArray()) return false;
  const auto array = value.As<Napi::TypedArray>();
  return array.TypedArrayType() == napi_float64_array && array.ElementLength() == words;
}

static Napi::Value LegacyInputError(Napi::Env env) {
  ThrowSpiceError(Napi::TypeError::New(env, "Invalid legacy geometry arguments or output storage"));
  return env.Undefined();
}

static Napi::Value Illum(const Napi::CallbackInfo& info) {
  const auto env = info.Env();
  if (info.Length() != 6) return LegacyInputError(env);
  std::string target;
  if (!ReadGeometryString(env, info[0], &target)) return env.Undefined();
  if (!info[1].IsNumber()) return LegacyInputError(env);
  const double et = info[1].As<Napi::Number>().DoubleValue();
  std::string abcorr;
  if (!ReadGeometryString(env, info[2], &abcorr)) return env.Undefined();
  std::string observer;
  if (!ReadGeometryString(env, info[3], &observer)) return env.Undefined();
  if (!LegacyStorage(info[4], 3)) return LegacyInputError(env);
  const double *spoint = info[4].As<Napi::Float64Array>().Data();
  if (!LegacyStorage(info[5], 3)) return LegacyInputError(env);
  double *out = info[5].As<Napi::Float64Array>().Data();
  char error[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_illum(
      target.c_str(), et, abcorr.c_str(), observer.c_str(), spoint, out, error, sizeof(error))) {
    ThrowSpiceError(env, "CSPICE failed while calling illum", error);
  }
  return env.Undefined();
}

static Napi::Value Srfxpt(const Napi::CallbackInfo& info) {
  const auto env = info.Env();
  if (info.Length() != 8) return LegacyInputError(env);
  std::string method;
  if (!ReadGeometryString(env, info[0], &method)) return env.Undefined();
  std::string target;
  if (!ReadGeometryString(env, info[1], &target)) return env.Undefined();
  if (!info[2].IsNumber()) return LegacyInputError(env);
  const double et = info[2].As<Napi::Number>().DoubleValue();
  std::string abcorr;
  if (!ReadGeometryString(env, info[3], &abcorr)) return env.Undefined();
  std::string observer;
  if (!ReadGeometryString(env, info[4], &observer)) return env.Undefined();
  std::string dref;
  if (!ReadGeometryString(env, info[5], &dref)) return env.Undefined();
  if (!LegacyStorage(info[6], 3)) return LegacyInputError(env);
  const double *dvec = info[6].As<Napi::Float64Array>().Data();
  if (!LegacyStorage(info[7], 9)) return LegacyInputError(env);
  double *out = info[7].As<Napi::Float64Array>().Data();
  char error[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_srfxpt(
      method.c_str(), target.c_str(), et, abcorr.c_str(), observer.c_str(), dref.c_str(), dvec, out, error, sizeof(error))) {
    ThrowSpiceError(env, "CSPICE failed while calling srfxpt", error);
  }
  return env.Undefined();
}

static Napi::Value Subpt(const Napi::CallbackInfo& info) {
  const auto env = info.Env();
  if (info.Length() != 6) return LegacyInputError(env);
  std::string method;
  if (!ReadGeometryString(env, info[0], &method)) return env.Undefined();
  std::string target;
  if (!ReadGeometryString(env, info[1], &target)) return env.Undefined();
  if (!info[2].IsNumber()) return LegacyInputError(env);
  const double et = info[2].As<Napi::Number>().DoubleValue();
  std::string abcorr;
  if (!ReadGeometryString(env, info[3], &abcorr)) return env.Undefined();
  std::string observer;
  if (!ReadGeometryString(env, info[4], &observer)) return env.Undefined();
  if (!LegacyStorage(info[5], 4)) return LegacyInputError(env);
  double *out = info[5].As<Napi::Float64Array>().Data();
  char error[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_subpt(
      method.c_str(), target.c_str(), et, abcorr.c_str(), observer.c_str(), out, error, sizeof(error))) {
    ThrowSpiceError(env, "CSPICE failed while calling subpt", error);
  }
  return env.Undefined();
}

static Napi::Value Subsol(const Napi::CallbackInfo& info) {
  const auto env = info.Env();
  if (info.Length() != 6) return LegacyInputError(env);
  std::string method;
  if (!ReadGeometryString(env, info[0], &method)) return env.Undefined();
  std::string target;
  if (!ReadGeometryString(env, info[1], &target)) return env.Undefined();
  if (!info[2].IsNumber()) return LegacyInputError(env);
  const double et = info[2].As<Napi::Number>().DoubleValue();
  std::string abcorr;
  if (!ReadGeometryString(env, info[3], &abcorr)) return env.Undefined();
  std::string observer;
  if (!ReadGeometryString(env, info[4], &observer)) return env.Undefined();
  if (!LegacyStorage(info[5], 3)) return LegacyInputError(env);
  double *out = info[5].As<Napi::Float64Array>().Data();
  char error[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_subsol(
      method.c_str(), target.c_str(), et, abcorr.c_str(), observer.c_str(), out, error, sizeof(error))) {
    ThrowSpiceError(env, "CSPICE failed while calling subsol", error);
  }
  return env.Undefined();
}

static Napi::Value Edterm(const Napi::CallbackInfo& info) {
  const auto env = info.Env();
  if (info.Length() != 9) return LegacyInputError(env);
  std::string trmtyp;
  if (!ReadGeometryString(env, info[0], &trmtyp)) return env.Undefined();
  std::string source;
  if (!ReadGeometryString(env, info[1], &source)) return env.Undefined();
  std::string target;
  if (!ReadGeometryString(env, info[2], &target)) return env.Undefined();
  if (!info[3].IsNumber()) return LegacyInputError(env);
  const double et = info[3].As<Napi::Number>().DoubleValue();
  std::string fixref;
  if (!ReadGeometryString(env, info[4], &fixref)) return env.Undefined();
  std::string abcorr;
  if (!ReadGeometryString(env, info[5], &abcorr)) return env.Undefined();
  std::string observer;
  if (!ReadGeometryString(env, info[6], &observer)) return env.Undefined();
  if (!info[7].IsNumber()) return LegacyInputError(env);
  const double count = info[7].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(count) || std::trunc(count) != count || count < std::numeric_limits<int>::min() || count > 11184809) return LegacyInputError(env);
  const int npts = static_cast<int>(count);
  if (!LegacyStorage(info[8], 4 + 3 * static_cast<size_t>(npts > 0 ? npts : 1))) return LegacyInputError(env);
  double *out = info[8].As<Napi::Float64Array>().Data();
  char error[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_edterm(
      trmtyp.c_str(), source.c_str(), target.c_str(), et, fixref.c_str(), abcorr.c_str(), observer.c_str(), npts, out, error, sizeof(error))) {
    ThrowSpiceError(env, "CSPICE failed while calling edterm", error);
  }
  return env.Undefined();
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
  if (!SetExportChecked(env, exports, "illum", Napi::Function::New(env, Illum), __func__)) return;
  if (!SetExportChecked(env, exports, "srfxpt", Napi::Function::New(env, Srfxpt), __func__)) return;
  if (!SetExportChecked(env, exports, "subpt", Napi::Function::New(env, Subpt), __func__)) return;
  if (!SetExportChecked(env, exports, "subsol", Napi::Function::New(env, Subsol), __func__)) return;
  if (!SetExportChecked(env, exports, "edterm", Napi::Function::New(env, Edterm), __func__)) return;
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
