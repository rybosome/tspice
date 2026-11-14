#include "geometry.h"

#include <cmath>
#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

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

template <size_t N>
static bool ReadPlaneArgument(Napi::Env env, const Napi::Value& source,
                              double (&dest)[N], const char* name) {
  if (!tspice_backend_node::ReadNumberArrayFixed(env, source, N, dest, name)) return false;
  for (double value : dest) {
    if (!std::isfinite(value)) {
      ThrowSpiceError(Napi::RangeError::New(env, std::string(name) + " must contain finite numbers"));
      return false;
    }
  }
  return true;
}

static Napi::Value Nvp2pl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "nvp2pl: incorrect argument count"));
    return env.Undefined();
  }
  double normal[3];
  if (!ReadPlaneArgument(env, info[0], normal, "nvp2pl(normal)")) return env.Undefined();
  double point[3];
  if (!ReadPlaneArgument(env, info[1], point, "nvp2pl(point)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double result[4] = {};
  if (tspice_nvp2pl(normal, point, result, err, sizeof(err))) {
    ThrowSpiceError(env, "nvp2pl", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, result, 4);
}

static Napi::Value Pl2nvp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "pl2nvp: incorrect argument count"));
    return env.Undefined();
  }
  double plane[4];
  if (!ReadPlaneArgument(env, info[0], plane, "pl2nvp(plane)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double normal[3] = {};
  double point[3] = {};
  if (tspice_pl2nvp(plane, normal, point, err, sizeof(err))) {
    ThrowSpiceError(env, "pl2nvp", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("normal", MakeNumberArray(env, normal, 3));
  result.Set("point", MakeNumberArray(env, point, 3));
  return result;
}

static Napi::Value Pl2psv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "pl2psv: incorrect argument count"));
    return env.Undefined();
  }
  double plane[4];
  if (!ReadPlaneArgument(env, info[0], plane, "pl2psv(plane)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double point[3] = {};
  double span1[3] = {};
  double span2[3] = {};
  if (tspice_pl2psv(plane, point, span1, span2, err, sizeof(err))) {
    ThrowSpiceError(env, "pl2psv", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("point", MakeNumberArray(env, point, 3));
  result.Set("span1", MakeNumberArray(env, span1, 3));
  result.Set("span2", MakeNumberArray(env, span2, 3));
  return result;
}

static Napi::Value Psv2pl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "psv2pl: incorrect argument count"));
    return env.Undefined();
  }
  double point[3];
  if (!ReadPlaneArgument(env, info[0], point, "psv2pl(point)")) return env.Undefined();
  double span1[3];
  if (!ReadPlaneArgument(env, info[1], span1, "psv2pl(span1)")) return env.Undefined();
  double span2[3];
  if (!ReadPlaneArgument(env, info[2], span2, "psv2pl(span2)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double result[4] = {};
  if (tspice_psv2pl(point, span1, span2, result, err, sizeof(err))) {
    ThrowSpiceError(env, "psv2pl", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, result, 4);
}

static Napi::Value Inrypl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "inrypl: incorrect argument count"));
    return env.Undefined();
  }
  double vertex[3];
  if (!ReadPlaneArgument(env, info[0], vertex, "inrypl(vertex)")) return env.Undefined();
  double dir[3];
  if (!ReadPlaneArgument(env, info[1], dir, "inrypl(dir)")) return env.Undefined();
  double plane[4];
  if (!ReadPlaneArgument(env, info[2], plane, "inrypl(plane)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int nxpts = 0;
  double xpt[3] = {};
  if (tspice_inrypl(vertex, dir, plane, &nxpts, xpt, err, sizeof(err))) {
    ThrowSpiceError(env, "inrypl", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("nxpts", Napi::Number::New(env, nxpts));
  result.Set("xpt", MakeNumberArray(env, xpt, 3));
  return result;
}

static Napi::Value Vprjp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vprjp: incorrect argument count"));
    return env.Undefined();
  }
  double vin[3];
  if (!ReadPlaneArgument(env, info[0], vin, "vprjp(vin)")) return env.Undefined();
  double plane[4];
  if (!ReadPlaneArgument(env, info[1], plane, "vprjp(plane)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double vout[3] = {};
  if (tspice_vprjp(vin, plane, vout, err, sizeof(err))) {
    ThrowSpiceError(env, "vprjp", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, vout, 3);
}

static Napi::Value Vprjpi(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "vprjpi: incorrect argument count"));
    return env.Undefined();
  }
  double vin[3];
  if (!ReadPlaneArgument(env, info[0], vin, "vprjpi(vin)")) return env.Undefined();
  double projpl[4];
  if (!ReadPlaneArgument(env, info[1], projpl, "vprjpi(projpl)")) return env.Undefined();
  double invpl[4];
  if (!ReadPlaneArgument(env, info[2], invpl, "vprjpi(invpl)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double vout[3] = {};
  int found = 0;
  if (tspice_vprjpi(vin, projpl, invpl, vout, &found, err, sizeof(err))) {
    ThrowSpiceError(env, "vprjpi", err);
    return env.Undefined();
  }
  if (!found) return MakeNotFound(env);
  Napi::Object result = Napi::Object::New(env);
  result.Set("vout", MakeNumberArray(env, vout, 3));
  result.Set("found", Napi::Boolean::New(env, true));
  return result;
}

static Napi::Value Nplnpt(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "nplnpt: incorrect argument count"));
    return env.Undefined();
  }
  double linpt[3];
  if (!ReadPlaneArgument(env, info[0], linpt, "nplnpt(linpt)")) return env.Undefined();
  double lindir[3];
  if (!ReadPlaneArgument(env, info[1], lindir, "nplnpt(lindir)")) return env.Undefined();
  double point[3];
  if (!ReadPlaneArgument(env, info[2], point, "nplnpt(point)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double pnear[3] = {};
  double dist = 0;
  if (tspice_nplnpt(linpt, lindir, point, pnear, &dist, err, sizeof(err))) {
    ThrowSpiceError(env, "nplnpt", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("pnear", MakeNumberArray(env, pnear, 3));
  result.Set("dist", Napi::Number::New(env, dist));
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
  if (!SetExportChecked(env, exports, "subpnt", Napi::Function::New(env, Subpnt), __func__)) return;
  if (!SetExportChecked(env, exports, "subslr", Napi::Function::New(env, Subslr), __func__)) return;
  if (!SetExportChecked(env, exports, "sincpt", Napi::Function::New(env, Sincpt), __func__)) return;
  if (!SetExportChecked(env, exports, "ilumin", Napi::Function::New(env, Ilumin), __func__)) return;
  if (!SetExportChecked(env, exports, "illumg", Napi::Function::New(env, Illumg), __func__)) return;
  if (!SetExportChecked(env, exports, "illumf", Napi::Function::New(env, Illumf), __func__)) return;
  if (!SetExportChecked(env, exports, "occult", Napi::Function::New(env, Occult), __func__)) return;
  if (!SetExportChecked(env, exports, "nvp2pl", Napi::Function::New(env, Nvp2pl), __func__)) return;
  if (!SetExportChecked(env, exports, "pl2nvp", Napi::Function::New(env, Pl2nvp), __func__)) return;
  if (!SetExportChecked(env, exports, "pl2psv", Napi::Function::New(env, Pl2psv), __func__)) return;
  if (!SetExportChecked(env, exports, "psv2pl", Napi::Function::New(env, Psv2pl), __func__)) return;
  if (!SetExportChecked(env, exports, "inrypl", Napi::Function::New(env, Inrypl), __func__)) return;
  if (!SetExportChecked(env, exports, "vprjp", Napi::Function::New(env, Vprjp), __func__)) return;
  if (!SetExportChecked(env, exports, "vprjpi", Napi::Function::New(env, Vprjpi), __func__)) return;
  if (!SetExportChecked(env, exports, "nplnpt", Napi::Function::New(env, Nplnpt), __func__)) return;
  if (!SetExportChecked(env, exports, "nvc2pl", Napi::Function::New(env, Nvc2pl), __func__)) return;
  if (!SetExportChecked(env, exports, "pl2nvc", Napi::Function::New(env, Pl2nvc), __func__)) return;
}

}  // namespace tspice_backend_node
