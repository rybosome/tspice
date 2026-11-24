#include "ephemeris.h"

#include <algorithm>
#include <vector>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <limits>
#include <string>

#include "../addon_common.h"
#include "../cell_handles.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::FixedWidthToJsString;
using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::PreviewForError;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

// Napi::Number canonicalizes NaN payloads, which can encode legitimate signed
// SPK identifier pairs. Keep descriptor words in a typed buffer across N-API;
// the TypeScript adapter then creates the existing public five-number tuple.
static Napi::Float64Array MakePackedSpkDescriptor(Napi::Env env, const double* words) {
  auto result = Napi::Float64Array::New(env, 5);
  std::memcpy(result.Data(), words, 5 * sizeof(double));
  return result;
}

static bool ReadInt32Checked(Napi::Env env, const Napi::Value& value, const char* what, int32_t* out) {
  const std::string label = (what != nullptr && what[0] != '\0') ? std::string(what) : std::string("value");

  if (!value.IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + label + " to be a number"));
    return false;
  }

  const double d = value.As<Napi::Number>().DoubleValue();
  const double lo = (double)std::numeric_limits<int32_t>::min();
  const double hi = (double)std::numeric_limits<int32_t>::max();
  if (!std::isfinite(d) || std::floor(d) != d || d < lo || d > hi) {
    ThrowSpiceError(
        Napi::TypeError::New(env, std::string("Expected ") + label + " to be a 32-bit signed integer"));
    return false;
  }

  if (out) {
    *out = (int32_t)d;
  }
  return true;
}

static Napi::Value TleArgumentError(Napi::Env env, const char* msg) {
  ThrowSpiceError(Napi::TypeError::New(env, msg));
  return env.Undefined();
}

static Napi::Value Getelm(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  int32_t year;
  if (info.Length() != 2 || !info[1].IsArray())
    return TleArgumentError(env, "getelm expects a first year and two ASCII records");
  if (!ReadInt32Checked(env, info[0], "firstYear", &year)) return env.Undefined();
  auto arr = info[1].As<Napi::Array>();
  if (arr.Length() != 2) return TleArgumentError(env, "getelm requires two records");
  std::string rows[2];
  size_t stride = 8;
  for (uint32_t i = 0; i < 2; i++) {
    auto value = arr.Get(i);
    if (env.IsExceptionPending()) return env.Undefined();
    if (!value.IsString()) return TleArgumentError(env, "TLE record must be a string");
    rows[i] = value.As<Napi::String>().Utf8Value();
    if (rows[i].size() >= 134217728)
      return TleArgumentError(env, "TLE records exceed the 256 MiB table bound");
    for (unsigned char c : rows[i])
      if (!c || c > 127) return TleArgumentError(env, "TLE records must be NUL-free ASCII");
    stride = std::max(stride, rows[i].size() + 1);
  }
  std::vector<char> table(2 * stride, 0);
  for (size_t i = 0; i < 2; i++) {
    std::fill_n(table.data() + i * stride, 7, ' ');
    std::copy(rows[i].begin(), rows[i].end(), table.data() + i * stride);
  }
  double epoch = 0, elems[10] = {};
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_getelm(year, static_cast<int>(stride), table.data(), &epoch, elems, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling getelm", err);
    return env.Undefined();
  }
  auto result = Napi::Object::New(env);
  result.Set("epoch", epoch);
  result.Set("elems", MakeNumberArray(env, elems, 10));
  return result;
}

static bool ReadTleNumbers(Napi::Env env, Napi::Value value, uint32_t size, double* out) {
  if (!value.IsArray() || value.As<Napi::Array>().Length() != size) {
    TleArgumentError(env, "SGP4 input tuple has the wrong extent");
    return false;
  }
  auto array = value.As<Napi::Array>();
  for (uint32_t i = 0; i < size; i++) {
    auto entry = array.Get(i);
    if (env.IsExceptionPending()) return false;
    if (!entry.IsNumber() || !std::isfinite(entry.As<Napi::Number>().DoubleValue())) {
      TleArgumentError(env, "SGP4 tuple entries must be finite");
      return false;
    }
    out[i] = entry.As<Napi::Number>().DoubleValue();
  }
  return true;
}

static Napi::Value Evsgp4(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 3 || !info[0].IsNumber())
    return TleArgumentError(env, "evsgp4 expects an ET and two numeric tuples");
  double et = info[0].As<Napi::Number>().DoubleValue(), geophs[8], elems[10], state[6] = {};
  if (!std::isfinite(et)) return TleArgumentError(env, "ET must be finite");
  if (!ReadTleNumbers(env, info[1], 8, geophs) || !ReadTleNumbers(env, info[2], 10, elems))
    return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_evsgp4(et, geophs, elems, state, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling evsgp4", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, state, 6);
}

static Napi::Object Ckgp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 4 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber() ||
      !info[3].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ckgp(inst: number, sclkdp: number, tol: number, ref: string) expects (number, number, number, string)"));
    return Napi::Object::New(env);
  }

  const int inst = info[0].As<Napi::Number>().Int32Value();
  const double sclkdp = info[1].As<Napi::Number>().DoubleValue();
  const double tol = info[2].As<Napi::Number>().DoubleValue();
  const std::string ref = info[3].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double cmat[9] = {0};
  double clkout = 0.0;
  int found = 0;
  const int code =
      tspice_ckgp(inst, sclkdp, tol, ref.c_str(), cmat, &clkout, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ckgp", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("cmat", MakeNumberArray(env, cmat, 9));
  result.Set("clkout", Napi::Number::New(env, clkout));
  return result;
}

static Napi::Object Ckgpav(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 4 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber() ||
      !info[3].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ckgpav(inst: number, sclkdp: number, tol: number, ref: string) expects (number, number, number, string)"));
    return Napi::Object::New(env);
  }

  const int inst = info[0].As<Napi::Number>().Int32Value();
  const double sclkdp = info[1].As<Napi::Number>().DoubleValue();
  const double tol = info[2].As<Napi::Number>().DoubleValue();
  const std::string ref = info[3].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double cmat[9] = {0};
  double av[3] = {0};
  double clkout = 0.0;
  int found = 0;
  const int code = tspice_ckgpav(
      inst,
      sclkdp,
      tol,
      ref.c_str(),
      cmat,
      av,
      &clkout,
      &found,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ckgpav", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("cmat", MakeNumberArray(env, cmat, 9));
  result.Set("av", MakeNumberArray(env, av, 3));
  result.Set("clkout", Napi::Number::New(env, clkout));
  return result;
}

static bool ReadOrbitalScalar(Napi::Env env, const Napi::Value& value, const char* label, double* out) {
  if (value.IsNumber()) {
    *out = value.As<Napi::Number>().DoubleValue();
    if (std::isfinite(*out)) return true;
  }
  ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a finite number"));
  return false;
}

template <size_t N>
static bool ReadOrbitalTuple(Napi::Env env, const Napi::Value& value, const char* label, double (&out)[N]) {
  if (!value.IsArray() || value.As<Napi::Array>().Length() != N) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be an array of length " + std::to_string(N)));
    return false;
  }
  const Napi::Array array = value.As<Napi::Array>();
  for (uint32_t i = 0; i < N; ++i) {
    const auto entry = array.Get(i);
    if (env.IsExceptionPending() || !ReadOrbitalScalar(env, entry, label, &out[i])) return false;
  }
  return true;
}

static Napi::Value Conics(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "conics() expects 2 arguments"));
    return env.Undefined();
  }
  double elts[8];
  if (!ReadOrbitalTuple(env, info[0], "conics(elts)", elts)) return env.Undefined();
  double et;
  if (!ReadOrbitalScalar(env, info[1], "conics(et)", &et)) return env.Undefined();
  double out[6] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_conics(elts, et, out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling conics", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 6);
}

static Napi::Value Eqncpv(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "eqncpv() expects 5 arguments"));
    return env.Undefined();
  }
  double et;
  if (!ReadOrbitalScalar(env, info[0], "eqncpv(et)", &et)) return env.Undefined();
  double epoch;
  if (!ReadOrbitalScalar(env, info[1], "eqncpv(epoch)", &epoch)) return env.Undefined();
  double eqel[9];
  if (!ReadOrbitalTuple(env, info[2], "eqncpv(eqel)", eqel)) return env.Undefined();
  double rapol;
  if (!ReadOrbitalScalar(env, info[3], "eqncpv(rapol)", &rapol)) return env.Undefined();
  double decpol;
  if (!ReadOrbitalScalar(env, info[4], "eqncpv(decpol)", &decpol)) return env.Undefined();
  double out[6] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_eqncpv(et, epoch, eqel, rapol, decpol, out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling eqncpv", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 6);
}

static Napi::Value Oscelt(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "oscelt() expects 3 arguments"));
    return env.Undefined();
  }
  double state[6];
  if (!ReadOrbitalTuple(env, info[0], "oscelt(state)", state)) return env.Undefined();
  double et;
  if (!ReadOrbitalScalar(env, info[1], "oscelt(et)", &et)) return env.Undefined();
  double mu;
  if (!ReadOrbitalScalar(env, info[2], "oscelt(mu)", &mu)) return env.Undefined();
  double out[8] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_oscelt(state, et, mu, out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling oscelt", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 8);
}

static Napi::Value Oscltx(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "oscltx() expects 3 arguments"));
    return env.Undefined();
  }
  double state[6];
  if (!ReadOrbitalTuple(env, info[0], "oscltx(state)", state)) return env.Undefined();
  double et;
  if (!ReadOrbitalScalar(env, info[1], "oscltx(et)", &et)) return env.Undefined();
  double mu;
  if (!ReadOrbitalScalar(env, info[2], "oscltx(mu)", &mu)) return env.Undefined();
  double out[11] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_oscltx(state, et, mu, out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling oscltx", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 11);
}

static Napi::Value Prop2b(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "prop2b() expects 3 arguments"));
    return env.Undefined();
  }
  double gm;
  if (!ReadOrbitalScalar(env, info[0], "prop2b(gm)", &gm)) return env.Undefined();
  double pvinit[6];
  if (!ReadOrbitalTuple(env, info[1], "prop2b(pvinit)", pvinit)) return env.Undefined();
  double dt;
  if (!ReadOrbitalScalar(env, info[2], "prop2b(dt)", &dt)) return env.Undefined();
  double out[6] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_prop2b(gm, pvinit, dt, out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling prop2b", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 6);
}

static bool ReadCorrectionScalar(Napi::Env env, const Napi::Value& value, const char* label, double* out) {
  if (value.IsNumber()) {
    *out = value.As<Napi::Number>().DoubleValue();
    if (std::isfinite(*out)) return true;
  }
  ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a finite number"));
  return false;
}

template <size_t N>
static bool ReadCorrectionTuple(Napi::Env env, const Napi::Value& value, const char* label, double (&out)[N]) {
  if (!value.IsArray() || value.As<Napi::Array>().Length() != N) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be an array of length " + std::to_string(N)));
    return false;
  }
  const Napi::Array array = value.As<Napi::Array>();
  for (uint32_t i = 0; i < N; ++i) {
    const auto entry = array.Get(i);
    if (env.IsExceptionPending() || !ReadCorrectionScalar(env, entry, label, &out[i])) return false;
  }
  return true;
}

static bool ReadCorrectionString(Napi::Env env, const Napi::Value& value, const char* label, std::string* out) {
  if (value.IsString()) {
    *out = value.As<Napi::String>().Utf8Value();
    if (!env.IsExceptionPending() && out->find(char(0)) == std::string::npos) return true;
  }
  ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a string without embedded NUL"));
  return false;
}

static Napi::Value Spkcpo(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 8) {
    ThrowSpiceError(Napi::TypeError::New(env,"spkcpo expects 8 arguments"));
    return env.Undefined();
  }
  std::string target;
  if (!ReadCorrectionString(env,info[0],"spkcpo(target)",&target)) return env.Undefined();
  double et;
  if (!ReadCorrectionScalar(env,info[1],"spkcpo(et)",&et)) return env.Undefined();
  std::string outref;
  if (!ReadCorrectionString(env,info[2],"spkcpo(outref)",&outref)) return env.Undefined();
  std::string refloc;
  if (!ReadCorrectionString(env,info[3],"spkcpo(refloc)",&refloc)) return env.Undefined();
  std::string abcorr;
  if (!ReadCorrectionString(env,info[4],"spkcpo(abcorr)",&abcorr)) return env.Undefined();
  double obspos[3];
  if (!ReadCorrectionTuple(env,info[5],"spkcpo(obspos)",obspos)) return env.Undefined();
  std::string obsctr;
  if (!ReadCorrectionString(env,info[6],"spkcpo(obsctr)",&obsctr)) return env.Undefined();
  std::string obsref;
  if (!ReadCorrectionString(env,info[7],"spkcpo(obsref)",&obsref)) return env.Undefined();
  double out[7]={0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_spkcpo(target.c_str(), et, outref.c_str(), refloc.c_str(), abcorr.c_str(), obspos, obsctr.c_str(), obsref.c_str(),out,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling spkcpo",err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out,7);
}

static Napi::Value Spkcpt(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 8) {
    ThrowSpiceError(Napi::TypeError::New(env,"spkcpt expects 8 arguments"));
    return env.Undefined();
  }
  double trgpos[3];
  if (!ReadCorrectionTuple(env,info[0],"spkcpt(trgpos)",trgpos)) return env.Undefined();
  std::string trgctr;
  if (!ReadCorrectionString(env,info[1],"spkcpt(trgctr)",&trgctr)) return env.Undefined();
  std::string trgref;
  if (!ReadCorrectionString(env,info[2],"spkcpt(trgref)",&trgref)) return env.Undefined();
  double et;
  if (!ReadCorrectionScalar(env,info[3],"spkcpt(et)",&et)) return env.Undefined();
  std::string outref;
  if (!ReadCorrectionString(env,info[4],"spkcpt(outref)",&outref)) return env.Undefined();
  std::string refloc;
  if (!ReadCorrectionString(env,info[5],"spkcpt(refloc)",&refloc)) return env.Undefined();
  std::string abcorr;
  if (!ReadCorrectionString(env,info[6],"spkcpt(abcorr)",&abcorr)) return env.Undefined();
  std::string obsrvr;
  if (!ReadCorrectionString(env,info[7],"spkcpt(obsrvr)",&obsrvr)) return env.Undefined();
  double out[7]={0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_spkcpt(trgpos, trgctr.c_str(), trgref.c_str(), et, outref.c_str(), refloc.c_str(), abcorr.c_str(), obsrvr.c_str(),out,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling spkcpt",err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out,7);
}

static Napi::Value Spkcvo(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 9) {
    ThrowSpiceError(Napi::TypeError::New(env,"spkcvo expects 9 arguments"));
    return env.Undefined();
  }
  std::string target;
  if (!ReadCorrectionString(env,info[0],"spkcvo(target)",&target)) return env.Undefined();
  double et;
  if (!ReadCorrectionScalar(env,info[1],"spkcvo(et)",&et)) return env.Undefined();
  std::string outref;
  if (!ReadCorrectionString(env,info[2],"spkcvo(outref)",&outref)) return env.Undefined();
  std::string refloc;
  if (!ReadCorrectionString(env,info[3],"spkcvo(refloc)",&refloc)) return env.Undefined();
  std::string abcorr;
  if (!ReadCorrectionString(env,info[4],"spkcvo(abcorr)",&abcorr)) return env.Undefined();
  double obssta[6];
  if (!ReadCorrectionTuple(env,info[5],"spkcvo(obssta)",obssta)) return env.Undefined();
  double obsepc;
  if (!ReadCorrectionScalar(env,info[6],"spkcvo(obsepc)",&obsepc)) return env.Undefined();
  std::string obsctr;
  if (!ReadCorrectionString(env,info[7],"spkcvo(obsctr)",&obsctr)) return env.Undefined();
  std::string obsref;
  if (!ReadCorrectionString(env,info[8],"spkcvo(obsref)",&obsref)) return env.Undefined();
  double out[7]={0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_spkcvo(target.c_str(), et, outref.c_str(), refloc.c_str(), abcorr.c_str(), obssta, obsepc, obsctr.c_str(), obsref.c_str(),out,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling spkcvo",err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out,7);
}

static Napi::Value Spkcvt(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 9) {
    ThrowSpiceError(Napi::TypeError::New(env,"spkcvt expects 9 arguments"));
    return env.Undefined();
  }
  double trgsta[6];
  if (!ReadCorrectionTuple(env,info[0],"spkcvt(trgsta)",trgsta)) return env.Undefined();
  double trgepc;
  if (!ReadCorrectionScalar(env,info[1],"spkcvt(trgepc)",&trgepc)) return env.Undefined();
  std::string trgctr;
  if (!ReadCorrectionString(env,info[2],"spkcvt(trgctr)",&trgctr)) return env.Undefined();
  std::string trgref;
  if (!ReadCorrectionString(env,info[3],"spkcvt(trgref)",&trgref)) return env.Undefined();
  double et;
  if (!ReadCorrectionScalar(env,info[4],"spkcvt(et)",&et)) return env.Undefined();
  std::string outref;
  if (!ReadCorrectionString(env,info[5],"spkcvt(outref)",&outref)) return env.Undefined();
  std::string refloc;
  if (!ReadCorrectionString(env,info[6],"spkcvt(refloc)",&refloc)) return env.Undefined();
  std::string abcorr;
  if (!ReadCorrectionString(env,info[7],"spkcvt(abcorr)",&abcorr)) return env.Undefined();
  std::string obsrvr;
  if (!ReadCorrectionString(env,info[8],"spkcvt(obsrvr)",&obsrvr)) return env.Undefined();
  double out[7]={0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_spkcvt(trgsta, trgepc, trgctr.c_str(), trgref.c_str(), et, outref.c_str(), refloc.c_str(), abcorr.c_str(), obsrvr.c_str(),out,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling spkcvt",err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out,7);
}

static Napi::Value Azlcpo(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 9) {
    ThrowSpiceError(Napi::TypeError::New(env,"azlcpo expects 9 arguments"));
    return env.Undefined();
  }
  std::string method;
  if (!ReadCorrectionString(env,info[0],"azlcpo(method)",&method)) return env.Undefined();
  std::string target;
  if (!ReadCorrectionString(env,info[1],"azlcpo(target)",&target)) return env.Undefined();
  double et;
  if (!ReadCorrectionScalar(env,info[2],"azlcpo(et)",&et)) return env.Undefined();
  std::string abcorr;
  if (!ReadCorrectionString(env,info[3],"azlcpo(abcorr)",&abcorr)) return env.Undefined();
  if (!info[4].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env,"azccw must be boolean"));
    return env.Undefined();
  }
  const bool azccw=info[4].As<Napi::Boolean>().Value();
  if (!info[5].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env,"elplsz must be boolean"));
    return env.Undefined();
  }
  const bool elplsz=info[5].As<Napi::Boolean>().Value();
  double obspos[3];
  if (!ReadCorrectionTuple(env,info[6],"azlcpo(obspos)",obspos)) return env.Undefined();
  std::string obsctr;
  if (!ReadCorrectionString(env,info[7],"azlcpo(obsctr)",&obsctr)) return env.Undefined();
  std::string obsref;
  if (!ReadCorrectionString(env,info[8],"azlcpo(obsref)",&obsref)) return env.Undefined();
  double out[7]={0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_azlcpo(method.c_str(), target.c_str(), et, abcorr.c_str(), azccw, elplsz, obspos, obsctr.c_str(), obsref.c_str(),out,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling azlcpo",err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out,7);
}

static Napi::Value Spkacs(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkacs() expects 5 arguments"));
    return env.Undefined();
  }
  int32_t target;
  if (!ReadInt32Checked(env, info[0], "spkacs(target)", &target)) return env.Undefined();
  double et;
  if (!ReadCorrectionScalar(env, info[1], "spkacs(et)", &et)) return env.Undefined();
  std::string ref;
  if (!ReadCorrectionString(env, info[2], "spkacs(ref)", &ref)) return env.Undefined();
  std::string abcorr;
  if (!ReadCorrectionString(env, info[3], "spkacs(abcorr)", &abcorr)) return env.Undefined();
  int32_t observer;
  if (!ReadInt32Checked(env, info[4], "spkacs(observer)", &observer)) return env.Undefined();
  double out[8] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_spkacs(target, et, ref.c_str(), abcorr.c_str(), observer, out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkacs", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 8);
}

static Napi::Value Spkapo(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkapo() expects 5 arguments"));
    return env.Undefined();
  }
  int32_t target;
  if (!ReadInt32Checked(env, info[0], "spkapo(target)", &target)) return env.Undefined();
  double et;
  if (!ReadCorrectionScalar(env, info[1], "spkapo(et)", &et)) return env.Undefined();
  std::string ref;
  if (!ReadCorrectionString(env, info[2], "spkapo(ref)", &ref)) return env.Undefined();
  double observerState[6];
  if (!ReadCorrectionTuple(env, info[3], "spkapo(observerState)", observerState)) return env.Undefined();
  std::string abcorr;
  if (!ReadCorrectionString(env, info[4], "spkapo(abcorr)", &abcorr)) return env.Undefined();
  double out[4] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_spkapo(target, et, ref.c_str(), observerState, abcorr.c_str(), out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkapo", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 4);
}

static Napi::Value Spkapp(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkapp() expects 5 arguments"));
    return env.Undefined();
  }
  int32_t target;
  if (!ReadInt32Checked(env, info[0], "spkapp(target)", &target)) return env.Undefined();
  double et;
  if (!ReadCorrectionScalar(env, info[1], "spkapp(et)", &et)) return env.Undefined();
  std::string ref;
  if (!ReadCorrectionString(env, info[2], "spkapp(ref)", &ref)) return env.Undefined();
  double observerState[6];
  if (!ReadCorrectionTuple(env, info[3], "spkapp(observerState)", observerState)) return env.Undefined();
  std::string abcorr;
  if (!ReadCorrectionString(env, info[4], "spkapp(abcorr)", &abcorr)) return env.Undefined();
  double out[7] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_spkapp(target, et, ref.c_str(), observerState, abcorr.c_str(), out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkapp", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 7);
}

static Napi::Value Spkaps(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 6) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkaps() expects 6 arguments"));
    return env.Undefined();
  }
  int32_t target;
  if (!ReadInt32Checked(env, info[0], "spkaps(target)", &target)) return env.Undefined();
  double et;
  if (!ReadCorrectionScalar(env, info[1], "spkaps(et)", &et)) return env.Undefined();
  std::string ref;
  if (!ReadCorrectionString(env, info[2], "spkaps(ref)", &ref)) return env.Undefined();
  std::string abcorr;
  if (!ReadCorrectionString(env, info[3], "spkaps(abcorr)", &abcorr)) return env.Undefined();
  double observerState[6];
  if (!ReadCorrectionTuple(env, info[4], "spkaps(observerState)", observerState)) return env.Undefined();
  double observerAcceleration[3];
  if (!ReadCorrectionTuple(env, info[5], "spkaps(observerAcceleration)", observerAcceleration)) return env.Undefined();
  double out[8] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_spkaps(target, et, ref.c_str(), abcorr.c_str(), observerState, observerAcceleration, out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkaps", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 8);
}

static Napi::Value Spkltc(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkltc() expects 5 arguments"));
    return env.Undefined();
  }
  int32_t target;
  if (!ReadInt32Checked(env, info[0], "spkltc(target)", &target)) return env.Undefined();
  double et;
  if (!ReadCorrectionScalar(env, info[1], "spkltc(et)", &et)) return env.Undefined();
  std::string ref;
  if (!ReadCorrectionString(env, info[2], "spkltc(ref)", &ref)) return env.Undefined();
  std::string abcorr;
  if (!ReadCorrectionString(env, info[3], "spkltc(abcorr)", &abcorr)) return env.Undefined();
  double observerState[6];
  if (!ReadCorrectionTuple(env, info[4], "spkltc(observerState)", observerState)) return env.Undefined();
  double out[8] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_spkltc(target, et, ref.c_str(), abcorr.c_str(), observerState, out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkltc", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 8);
}

static Napi::Value Stelab(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "stelab() expects 2 arguments"));
    return env.Undefined();
  }
  double position[3];
  if (!ReadCorrectionTuple(env, info[0], "stelab(position)", position)) return env.Undefined();
  double observerVelocity[3];
  if (!ReadCorrectionTuple(env, info[1], "stelab(observerVelocity)", observerVelocity)) return env.Undefined();
  double out[3] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_stelab(position, observerVelocity, out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling stelab", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 3);
}

static Napi::Value Stlabx(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "stlabx() expects 2 arguments"));
    return env.Undefined();
  }
  double position[3];
  if (!ReadCorrectionTuple(env, info[0], "stlabx(position)", position)) return env.Undefined();
  double observerVelocity[3];
  if (!ReadCorrectionTuple(env, info[1], "stlabx(observerVelocity)", observerVelocity)) return env.Undefined();
  double out[3] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_stlabx(position, observerVelocity, out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling stlabx", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 3);
}

static Napi::Value Ltime(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "ltime() expects 4 arguments"));
    return env.Undefined();
  }
  double etobs;
  if (!ReadCorrectionScalar(env, info[0], "ltime(etobs)", &etobs)) return env.Undefined();
  int32_t observer;
  if (!ReadInt32Checked(env, info[1], "ltime(observer)", &observer)) return env.Undefined();
  std::string dir;
  if (!ReadCorrectionString(env, info[2], "ltime(dir)", &dir)) return env.Undefined();
  int32_t target;
  if (!ReadInt32Checked(env, info[3], "ltime(target)", &target)) return env.Undefined();
  double out[2] = {0};
  char err[tspice_backend_node::kErrMaxBytes];
  tspice_backend_node::CspiceLock lock;
  if (tspice_ltime(etobs, observer, dir.c_str(), target, out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ltime", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 2);
}

static Napi::Object Spkezr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsString() ||
      !info[3].IsString() || !info[4].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "spkezr(target: string, et: number, ref: string, abcorr: string, observer: string) expects (string, number, string, string, string)"));
    return Napi::Object::New(env);
  }

  const std::string target = info[0].As<Napi::String>().Utf8Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[3].As<Napi::String>().Utf8Value();
  const std::string observer = info[4].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double state[6] = {0};
  double lt = 0.0;
  const int code = tspice_spkezr(
      target.c_str(),
      et,
      ref.c_str(),
      abcorr.c_str(),
      observer.c_str(),
      state,
      &lt,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkezr", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("state", MakeNumberArray(env, state, 6));
  result.Set("lt", Napi::Number::New(env, lt));
  return result;
}

static Napi::Object Spkpos(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsString() ||
      !info[3].IsString() || !info[4].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "spkpos(target: string, et: number, ref: string, abcorr: string, observer: string) expects (string, number, string, string, string)"));
    return Napi::Object::New(env);
  }

  const std::string target = info[0].As<Napi::String>().Utf8Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[3].As<Napi::String>().Utf8Value();
  const std::string observer = info[4].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double pos[3] = {0};
  double lt = 0.0;
  const int code = tspice_spkpos(
      target.c_str(),
      et,
      ref.c_str(),
      abcorr.c_str(),
      observer.c_str(),
      pos,
      &lt,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkpos", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("pos", MakeNumberArray(env, pos, 3));
  result.Set("lt", Napi::Number::New(env, lt));
  return result;
}

static Napi::Object Spkez(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[1].IsNumber() || !info[2].IsString() || !info[3].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "spkez(target: number, et: number, ref: string, abcorr: string, observer: number) expects (number, number, string, string, number)"));
    return Napi::Object::New(env);
  }

  int32_t target = 0;
  if (!ReadInt32Checked(env, info[0], "target", &target)) {
    return Napi::Object::New(env);
  }

  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[3].As<Napi::String>().Utf8Value();

  int32_t observer = 0;
  if (!ReadInt32Checked(env, info[4], "observer", &observer)) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double state[6] = {0};
  double lt = 0.0;

  const int code = tspice_spkez(target, et, ref.c_str(), abcorr.c_str(), observer, state, &lt, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkez", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("state", MakeNumberArray(env, state, 6));
  result.Set("lt", Napi::Number::New(env, lt));
  return result;
}

static Napi::Object Spkezp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[1].IsNumber() || !info[2].IsString() || !info[3].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "spkezp(target: number, et: number, ref: string, abcorr: string, observer: number) expects (number, number, string, string, number)"));
    return Napi::Object::New(env);
  }

  int32_t target = 0;
  if (!ReadInt32Checked(env, info[0], "target", &target)) {
    return Napi::Object::New(env);
  }

  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[3].As<Napi::String>().Utf8Value();

  int32_t observer = 0;
  if (!ReadInt32Checked(env, info[4], "observer", &observer)) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double pos[3] = {0};
  double lt = 0.0;

  const int code = tspice_spkezp(target, et, ref.c_str(), abcorr.c_str(), observer, pos, &lt, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkezp", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("pos", MakeNumberArray(env, pos, 3));
  result.Set("lt", Napi::Number::New(env, lt));
  return result;
}

static Napi::Object Spkgeo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 4 || !info[1].IsNumber() || !info[2].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "spkgeo(target: number, et: number, ref: string, observer: number) expects (number, number, string, number)"));
    return Napi::Object::New(env);
  }

  int32_t target = 0;
  if (!ReadInt32Checked(env, info[0], "target", &target)) {
    return Napi::Object::New(env);
  }

  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();

  int32_t observer = 0;
  if (!ReadInt32Checked(env, info[3], "observer", &observer)) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double state[6] = {0};
  double lt = 0.0;

  const int code = tspice_spkgeo(target, et, ref.c_str(), observer, state, &lt, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkgeo", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("state", MakeNumberArray(env, state, 6));
  result.Set("lt", Napi::Number::New(env, lt));
  return result;
}

static Napi::Object Spkgps(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 4 || !info[1].IsNumber() || !info[2].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "spkgps(target: number, et: number, ref: string, observer: number) expects (number, number, string, number)"));
    return Napi::Object::New(env);
  }

  int32_t target = 0;
  if (!ReadInt32Checked(env, info[0], "target", &target)) {
    return Napi::Object::New(env);
  }

  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();

  int32_t observer = 0;
  if (!ReadInt32Checked(env, info[3], "observer", &observer)) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double pos[3] = {0};
  double lt = 0.0;

  const int code = tspice_spkgps(target, et, ref.c_str(), observer, pos, &lt, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkgps", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("pos", MakeNumberArray(env, pos, 3));
  result.Set("lt", Napi::Number::New(env, lt));
  return result;
}

static Napi::Array Spkssb(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[1].IsNumber() || !info[2].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkssb(target: number, et: number, ref: string) expects 3 args"));
    return Napi::Array::New(env);
  }

  int32_t target = 0;
  if (!ReadInt32Checked(env, info[0], "target", &target)) {
    return Napi::Array::New(env);
  }

  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double state[6] = {0};

  const int code = tspice_spkssb(target, et, ref.c_str(), state, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkssb", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, state, 6);
}

static Napi::Value Spkcov(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "spkcov(spk: string, idcode: number, cover: SpiceWindow) expects (string, number, handle)"));
    return env.Undefined();
  }

  const std::string spk = info[0].As<Napi::String>().Utf8Value();

  int32_t idcode = 0;
  if (!ReadInt32Checked(env, info[1], "idcode", &idcode)) {
    return env.Undefined();
  }

  uint32_t windowHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "cover", &windowHandle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t windowPtr = tspice_backend_node::GetCellHandlePtrOrThrow(
      lock,
      env,
      windowHandle,
      SPICE_DP,
      "spkcov(cover)",
      "SpiceWindow");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_spkcov(spk.c_str(), idcode, windowPtr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkcov", err);
  }

  return env.Undefined();
}

static Napi::Value Spkobj(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkobj(spk: string, ids: SpiceIntCell) expects (string, handle)"));
    return env.Undefined();
  }

  const std::string spk = info[0].As<Napi::String>().Utf8Value();

  uint32_t cellHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "ids", &cellHandle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t cellPtr = tspice_backend_node::GetCellHandlePtrOrThrow(
      lock,
      env,
      cellHandle,
      SPICE_INT,
      "spkobj(ids)",
      "SpiceIntCell");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_spkobj(spk.c_str(), cellPtr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkobj", err);
  }

  return env.Undefined();
}

static Napi::Value Spklef(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length()!=1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env,"Expected SPK path")); return env.Undefined();
  }
  const std::string path=info[0].As<Napi::String>().Utf8Value();
  if (path.find('\0')!=std::string::npos) {ThrowSpiceError(Napi::TypeError::New(env,"Invalid SPK path")); return env.Undefined();}
  int generation=0;char err[tspice_backend_node::kErrMaxBytes]={};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_spklef(path.c_str(),&generation,err,sizeof err)) {ThrowSpiceError(env,"spklef",err);return env.Undefined();}
  return Napi::Number::New(env,generation);
}
static Napi::Value Spkuef(const Napi::CallbackInfo& info) {
  auto env=info.Env();int generation=0;
  if (!ReadInt32Checked(env,info[0],"SPK generation",&generation)) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes]={};std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if(tspice_spkuef(generation,err,sizeof err))ThrowSpiceError(env,"spkuef",err);
  return env.Undefined();
}
static bool ReadSpkSource(const Napi::CallbackInfo& info,int* source,int* registered,double words[5]) {
  auto env=info.Env();
  if(!ReadInt32Checked(env,info[0],"SPK source",source)) return false;
  if(!info[1].IsBoolean()||!info[2].IsTypedArray()||
     info[2].As<Napi::TypedArray>().TypedArrayType()!=napi_uint8_array||
     info[2].As<Napi::Uint8Array>().ByteLength()!=40){
    ThrowSpiceError(Napi::TypeError::New(env,"Expected source kind and 40 packed SPK bytes"));return false;
  }
  *registered=info[1].As<Napi::Boolean>().Value();
  std::memcpy(words,info[2].As<Napi::Uint8Array>().Data(),40);return true;
}
static Napi::Value Spkpvn(const Napi::CallbackInfo& info) {
  auto env=info.Env(); int source=0,registered=0,ref=0,center=0; double words[5],state[6]={};
  if(info.Length()!=4||!info[3].IsNumber()){ThrowSpiceError(Napi::TypeError::New(env,"Expected SPK source, descriptor and epoch"));return env.Undefined();}
  if(!ReadSpkSource(info,&source,&registered,words))return env.Undefined();
  const double et=info[3].As<Napi::Number>().DoubleValue();char err[tspice_backend_node::kErrMaxBytes]={};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if(tspice_spkpvn(source,registered,words,40,et,&ref,state,&center,err,sizeof err)){
    ThrowSpiceError(env,"spkpvn",err);return env.Undefined();
  }
  auto result=Napi::Object::New(env);result.Set("ref",ref);result.Set("center",center);result.Set("state",MakeNumberArray(env,state,6));return result;
}
static Napi::Value Spksub(const Napi::CallbackInfo& info) {
  auto env=info.Env();int source=0,registered=0,writer=0;double words[5];
  if(info.Length()!=7||!info[3].IsString()||!info[4].IsNumber()||!info[5].IsNumber()){
    ThrowSpiceError(Napi::TypeError::New(env,"Expected source, subset identifier, interval and writer"));return env.Undefined();
  }
  if(!ReadSpkSource(info,&source,&registered,words)||!ReadInt32Checked(env,info[6],"writer",&writer))return env.Undefined();
  auto ident=info[3].As<Napi::String>().Utf8Value();if(ident.find('\0')!=std::string::npos){ThrowSpiceError(Napi::TypeError::New(env,"Invalid segment ID"));return env.Undefined();}
  char err[tspice_backend_node::kErrMaxBytes]={};std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if(tspice_spksub(source,registered,words,40,ident.c_str(),info[4].As<Napi::Number>().DoubleValue(),info[5].As<Napi::Number>().DoubleValue(),writer,err,sizeof err))ThrowSpiceError(env,"spksub",err);
  return env.Undefined();
}

static Napi::Object Spksfs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "spksfs(body: number, et: number) expects (number, number)"));
    return Napi::Object::New(env);
  }

  int32_t body = 0;
  if (!ReadInt32Checked(env, info[0], "body", &body)) {
    return Napi::Object::New(env);
  }

  const double et = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  double descr[5] = {0};
  char ident[41];
  ident[0] = '\0';
  int found = 0;

  int generation=0;
  const int code = tspice_spksfs(body, et, &handle, &generation, descr, ident, (int)sizeof(ident), &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spksfs", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("handle", Napi::Number::New(env, static_cast<double>(handle)));
  result.Set("generation", Napi::Number::New(env,generation));
  result.Set("descr", MakePackedSpkDescriptor(env, descr));
  result.Set("ident", FixedWidthToJsString(env, ident, sizeof(ident)));
  return result;
}

static Napi::Float64Array Spkpds(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 6 || !info[2].IsString() || !info[4].IsNumber() || !info[5].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "spkpds(body: number, center: number, frame: string, type: number, first: number, last: number) expects 6 args"));
    return Napi::Float64Array::New(env, 0);
  }

  int32_t body = 0;
  if (!ReadInt32Checked(env, info[0], "body", &body)) {
    return Napi::Float64Array::New(env, 0);
  }

  int32_t center = 0;
  if (!ReadInt32Checked(env, info[1], "center", &center)) {
    return Napi::Float64Array::New(env, 0);
  }

  const std::string frame = info[2].As<Napi::String>().Utf8Value();

  int32_t type = 0;
  if (!ReadInt32Checked(env, info[3], "type", &type)) {
    return Napi::Float64Array::New(env, 0);
  }

  const double first = info[4].As<Napi::Number>().DoubleValue();
  const double last = info[5].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double descr[5] = {0};

  const int code = tspice_spkpds(body, center, frame.c_str(), type, first, last, descr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkpds", err);
    return Napi::Float64Array::New(env, 0);
  }

  return MakePackedSpkDescriptor(env, descr);
}

static Napi::Object Spkuds(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkuds(descr: number[5]) expects 1 argument"));
    return Napi::Object::New(env);
  }

  double descr[5] = {0};
  if (info[0].IsTypedArray() && info[0].As<Napi::TypedArray>().TypedArrayType() == napi_float64_array) {
    auto words = info[0].As<Napi::Float64Array>();
    if (words.ElementLength() != 5) {
      ThrowSpiceError(Napi::TypeError::New(env, "SPK descriptor must contain five words"));
      return Napi::Object::New(env);
    }
    std::memcpy(descr, words.Data(), sizeof(descr));
  } else if (!tspice_backend_node::ReadNumberArrayFixed(env, info[0], 5, descr, "descr")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];

  int body = 0;
  int center = 0;
  int frame = 0;
  int type = 0;
  double first = 0.0;
  double last = 0.0;
  int baddr = 0;
  int eaddr = 0;

  const int code = tspice_spkuds(
      descr,
      &body,
      &center,
      &frame,
      &type,
      &first,
      &last,
      &baddr,
      &eaddr,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkuds", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("body", Napi::Number::New(env, static_cast<double>(body)));
  result.Set("center", Napi::Number::New(env, static_cast<double>(center)));
  result.Set("frame", Napi::Number::New(env, static_cast<double>(frame)));
  result.Set("type", Napi::Number::New(env, static_cast<double>(type)));
  result.Set("first", Napi::Number::New(env, first));
  result.Set("last", Napi::Number::New(env, last));
  result.Set("baddr", Napi::Number::New(env, static_cast<double>(baddr)));
  result.Set("eaddr", Napi::Number::New(env, static_cast<double>(eaddr)));
  return result;
}


static Napi::Number Spkopn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "spkopn(path: string, ifname: string, ncomch: number) expects (string, string, number)"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();
  const std::string ifname = info[1].As<Napi::String>().Utf8Value();

  int32_t ncomch = 0;
  if (!ReadInt32Checked(env, info[2], "ncomch", &ncomch)) {
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_spkopn(path.c_str(), ifname.c_str(), ncomch, &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling spkopn(\"") + PreviewForError(path) + "\")",
        err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static Napi::Number Spkopa(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkopa(path: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_spkopa(path.c_str(), &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling spkopa(\"") + PreviewForError(path) + "\")",
        err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static void Spkcls(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkcls(handle: number) expects exactly one numeric handle"));
    return;
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_spkcls(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling spkcls(handle=") + std::to_string(handle) + ")", err);
  }
}

static void Spkw08(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 11 || !info[3].IsString() || !info[6].IsString() ||
      (!info[8].IsArray() && !info[8].IsTypedArray())) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "spkw08(handle: number, body: number, center: number, frame: string, first: number, last: number, segid: string, degree: number, states: number[] | Float64Array, epoch1: number, step: number) expects (number, number, number, string, number, number, string, number, number[] | Float64Array, number, number)"));
    return;
  }

  int32_t handle = 0;
  int32_t body = 0;
  int32_t center = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return;
  if (!ReadInt32Checked(env, info[1], "body", &body)) return;
  if (!ReadInt32Checked(env, info[2], "center", &center)) return;

  const std::string frame = info[3].As<Napi::String>().Utf8Value();

  if (!info[4].IsNumber() || !info[5].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkw08(): first and last must be numbers"));
    return;
  }
  const double first = info[4].As<Napi::Number>().DoubleValue();
  const double last = info[5].As<Napi::Number>().DoubleValue();

  const std::string segid = info[6].As<Napi::String>().Utf8Value();

  int32_t degree = 0;
  if (!ReadInt32Checked(env, info[7], "degree", &degree)) return;

  const double* statesPtr = nullptr;
  uint32_t statesLen = 0;
  std::vector<double> statesVec;
  if (info[8].IsTypedArray()) {
    Napi::TypedArray typed = info[8].As<Napi::TypedArray>();
    if (typed.TypedArrayType() != napi_float64_array) {
      ThrowSpiceError(Napi::TypeError::New(env, "spkw08(): states must be number[] or Float64Array"));
      return;
    }
    Napi::Float64Array statesArr = typed.As<Napi::Float64Array>();
    statesPtr = statesArr.Data();
    statesLen = statesArr.ElementLength();
  } else {
    Napi::Array statesArr = info[8].As<Napi::Array>();
    statesLen = statesArr.Length();

    statesVec.reserve(statesLen);
    for (uint32_t i = 0; i < statesLen; i++) {
      const Napi::Value v = statesArr.Get(i);
      if (!v.IsNumber()) {
        ThrowSpiceError(Napi::TypeError::New(env, "spkw08(): states must contain only numbers"));
        return;
      }
      const double d = v.As<Napi::Number>().DoubleValue();
      if (!std::isfinite(d)) {
        ThrowSpiceError(Napi::RangeError::New(env, "spkw08(): states must contain only finite numbers"));
        return;
      }
      statesVec.push_back(d);
    }
    statesPtr = statesVec.data();
  }
  if (!info[9].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkw08(): epoch1 must be a number"));
    return;
  }
  const double epoch1 = info[9].As<Napi::Number>().DoubleValue();

  if (!info[10].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkw08(): step must be a number"));
    return;
  }
  const double step = info[10].As<Napi::Number>().DoubleValue();

  if (statesLen == 0 || statesLen % 6 != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "spkw08(): states.length must be a non-zero multiple of 6"));
    return;
  }
  const uint32_t n = statesLen / 6;

  // Preserve existing validation behavior for JS arrays.
  if (info[8].IsTypedArray()) {
    for (uint32_t i = 0; i < statesLen; i++) {
      const double d = statesPtr[i];
      if (!std::isfinite(d)) {
        ThrowSpiceError(Napi::RangeError::New(env, "spkw08(): states must contain only finite numbers"));
        return;
      }
    }
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_spkw08_v2(
      handle,
      body,
      center,
      frame.c_str(),
      first,
      last,
      segid.c_str(),
      degree,
      (int)n,
      statesPtr,
      (int)statesLen,
      epoch1,
      step,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkw08", err);
  }
}

template <int Type>
static void SpkChebyshevWriter(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  const size_t nargs = Type == 20 ? 15 : 12;
  if (info.Length() != nargs || !info[3].IsString() || !info[6].IsString() ||
      !info[10].IsTypedArray()) {
    ThrowSpiceError(Napi::TypeError::New(
        env, "Expected SPK writer arguments and an owned Float64Array of coefficients"));
    return;
  }
  const auto data = info[10].As<Napi::TypedArray>();
  if (data.TypedArrayType() != napi_float64_array || data.ElementLength() > 33554432) {
    ThrowSpiceError(
        Napi::RangeError::New(env, "Expected at most 256 MiB of Float64Array coefficient data"));
    return;
  }
  int32_t handle, body, center, n, degree;
  if (!ReadInt32Checked(env, info[0], "handle", &handle) ||
      !ReadInt32Checked(env, info[1], "body", &body) ||
      !ReadInt32Checked(env, info[2], "center", &center) ||
      !ReadInt32Checked(env, info[8], "n", &n) ||
      !ReadInt32Checked(env, info[9], "degree", &degree))
    return;
  const auto frame = info[3].As<Napi::String>().Utf8Value(),
             segid = info[6].As<Napi::String>().Utf8Value();
  if (frame.find('\0') != std::string::npos || segid.find('\0') != std::string::npos) {
    ThrowSpiceError(Napi::TypeError::New(env, "Embedded NUL in SPK frame or identifier"));
    return;
  }
  double scalar[15] = {};
  for (size_t i = 4; i < nargs; ++i) {
    if (i == 6 || i == 8 || i == 9 || i == 10) continue;
    if (!info[i].IsNumber() ||
        !std::isfinite(scalar[i] = info[i].As<Napi::Number>().DoubleValue())) {
      ThrowSpiceError(Napi::TypeError::New(env, "Expected finite SPK writer input"));
      return;
    }
  }
  auto coefficients = data.As<Napi::Float64Array>();
  int words = static_cast<int>(coefficients.ElementLength());
  const double sentinel = 0;
  const double* ptr = words ? coefficients.Data() : &sentinel;
  const double first = scalar[4], last = scalar[5], intlen = scalar[7];
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int code;
  if constexpr (Type == 2)
    code = tspice_spkw02(handle, body, center, frame.c_str(), first, last, segid.c_str(), intlen, n,
                         degree, ptr, words, scalar[11], err, sizeof(err));
  else if constexpr (Type == 3)
    code = tspice_spkw03(handle, body, center, frame.c_str(), first, last, segid.c_str(), intlen, n,
                         degree, ptr, words, scalar[11], err, sizeof(err));
  else
    code = tspice_spkw20(handle, body, center, frame.c_str(), first, last, segid.c_str(), intlen, n,
                         degree, ptr, words, scalar[11], scalar[12], scalar[13], scalar[14], err,
                         sizeof(err));
  if (code) ThrowSpiceError(env, "CSPICE failed writing Chebyshev SPK segment", err);
}

static bool SpkInputWords(Napi::Env env, const Napi::Value& v, const double* sentinel,
                          const double** ptr, int* count) {
  if (!v.IsTypedArray() || v.As<Napi::TypedArray>().TypedArrayType() != napi_float64_array) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected owned Float64Array"));
    return false;
  }
  auto arr = v.As<Napi::Float64Array>();
  if (arr.ElementLength() > 33554432) {
    ThrowSpiceError(Napi::RangeError::New(env, "Interpolation buffer exceeds 256 MiB"));
    return false;
  }
  *count = static_cast<int>(arr.ElementLength());
  *ptr = *count ? arr.Data() : sentinel;
  return true;
}

template <int Type>
static void SpkInterpolationWriter(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  const size_t base = Type == 18 ? 2 : 1;
  if (info.Length() != base + (Type == 12 ? 11 : 10)) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid SPK interpolation writer arity"));
    return;
  }
  int32_t h, body, center, degree, subtype = 1;
  if (!ReadInt32Checked(env, info[0], "handle", &h) ||
      !ReadInt32Checked(env, info[base], "body", &body) ||
      !ReadInt32Checked(env, info[base + 1], "center", &center) ||
      !ReadInt32Checked(env, info[base + 6], "degree", &degree))
    return;
  if constexpr (Type == 18)
    if (!ReadInt32Checked(env, info[1], "subtype", &subtype)) return;
  if (!info[base + 2].IsString() || !info[base + 5].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected frame and segment identifier strings"));
    return;
  }
  const auto frame = info[base + 2].As<Napi::String>().Utf8Value(),
             id = info[base + 5].As<Napi::String>().Utf8Value();
  if (frame.find('\0') != std::string::npos || id.find('\0') != std::string::npos) {
    ThrowSpiceError(Napi::TypeError::New(env, "Embedded NUL in SPK string"));
    return;
  }
  auto scalar = [&](size_t i, double& out) {
    if (!info[i].IsNumber() || !std::isfinite(out = info[i].As<Napi::Number>().DoubleValue())) {
      ThrowSpiceError(Napi::TypeError::New(env, "Expected finite SPK epoch or step"));
      return false;
    }
    return true;
  };
  double first, last, epoch0 = 0, step = 0;
  int32_t n;
  if (!scalar(base + 3, first) || !scalar(base + 4, last) ||
      !ReadInt32Checked(env, info[base + 7], "n", &n))
    return;
  const double sentinel = 0, *samples = &sentinel, *epochs = &sentinel;
  int words = 0, epochCount = 0;
  if (!SpkInputWords(env, info[base + 8], &sentinel, &samples, &words)) return;
  if constexpr (Type == 12) {
    if (!scalar(base + 9, epoch0) || !scalar(base + 10, step)) return;
  } else if (!SpkInputWords(env, info[base + 9], &sentinel, &epochs, &epochCount))
    return;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int code;
  if constexpr (Type == 9)
    code = tspice_spkw09(h, body, center, frame.c_str(), first, last, id.c_str(), degree, n,
                         samples, words, epochs, epochCount, err, sizeof(err));
  else if constexpr (Type == 12)
    code = tspice_spkw12(h, body, center, frame.c_str(), first, last, id.c_str(), degree, n,
                         samples, words, epoch0, step, err, sizeof(err));
  else if constexpr (Type == 13)
    code = tspice_spkw13(h, body, center, frame.c_str(), first, last, id.c_str(), degree, n,
                         samples, words, epochs, epochCount, err, sizeof(err));
  else code = tspice_spkw18(h, subtype, body, center, frame.c_str(), first, last, id.c_str(), degree,
                           n, samples, words, epochs, epochCount, err, sizeof(err));
  if (code) ThrowSpiceError(env, "CSPICE failed writing interpolated SPK segment", err);
}

template <int Type>
static void WriteAnalyticSpk(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 9) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid analytic SPK writer arity"));
    return;
  }
  int32_t handle, body, center, n;
  if (!ReadInt32Checked(env, info[0], "handle", &handle) ||
      !ReadInt32Checked(env, info[1], "body", &body) ||
      !ReadInt32Checked(env, info[2], "center", &center) ||
      !ReadInt32Checked(env, info[7], "n", &n))
    return;
  if (!info[3].IsString() || !info[6].IsString() || !info[4].IsNumber() || !info[5].IsNumber() ||
      !info[8].IsTypedArray() ||
      info[8].As<Napi::TypedArray>().TypedArrayType() != napi_float64_array) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid analytic SPK strings, epochs or data"));
    return;
  }
  const auto frame = info[3].As<Napi::String>().Utf8Value(),
             id = info[6].As<Napi::String>().Utf8Value();
  auto buffer = info[8].As<Napi::Float64Array>();
  if (frame.find('\0') != std::string::npos || id.find('\0') != std::string::npos ||
      buffer.ElementLength() > 33554432) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid analytic SPK string or buffer length"));
    return;
  }
  const double first = info[4].As<Napi::Number>().DoubleValue(),
               last = info[5].As<Napi::Number>().DoubleValue();
  const int words = static_cast<int>(buffer.ElementLength());
  const double sentinel = 0, *data = words ? buffer.Data() : &sentinel;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int status;
  if constexpr (Type == 5)
    status = tspice_spkw05(handle, body, center, frame.c_str(), first, last, id.c_str(), n, data,
                           words, err, sizeof(err));
  else if constexpr (Type == 10)
    status = tspice_spkw10(handle, body, center, frame.c_str(), first, last, id.c_str(), n, data,
                           words, err, sizeof(err));
  else if constexpr (Type == 15)
    status = tspice_spkw15(handle, body, center, frame.c_str(), first, last, id.c_str(), n, data,
                           words, err, sizeof(err));
  else
    status = tspice_spkw17(handle, body, center, frame.c_str(), first, last, id.c_str(), n, data,
                           words, err, sizeof(err));
  if (status) ThrowSpiceError(env, "CSPICE failed writing analytic SPK segment", err);
}

static void BeginSpk14(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 8 || !info[1].IsString() || !info[4].IsString() || !info[5].IsNumber() ||
      !info[6].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid SPK14 begin arguments"));
    return;
  }
  int32_t h, b, c, d;
  if (!ReadInt32Checked(env, info[0], "handle", &h) ||
      !ReadInt32Checked(env, info[2], "body", &b) ||
      !ReadInt32Checked(env, info[3], "center", &c) ||
      !ReadInt32Checked(env, info[7], "degree", &d))
    return;
  auto id = info[1].As<Napi::String>().Utf8Value(), frame = info[4].As<Napi::String>().Utf8Value();
  if (id.find('\0') != std::string::npos || frame.find('\0') != std::string::npos) {
    ThrowSpiceError(Napi::TypeError::New(env, "Embedded NUL in SPK14 string"));
    return;
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_spk14b(h, id.c_str(), b, c, frame.c_str(), info[5].As<Napi::Number>().DoubleValue(),
                    info[6].As<Napi::Number>().DoubleValue(), d, err, sizeof(err)))
    ThrowSpiceError(env, "SPK14 begin failed", err);
}
static void AddSpk14(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid SPK14 add arguments"));
    return;
  }
  int32_t h, n;
  if (!ReadInt32Checked(env, info[0], "handle", &h) || !ReadInt32Checked(env, info[1], "count", &n))
    return;
  for (size_t i = 2; i < 4; i++)
    if (!info[i].IsTypedArray() ||
        info[i].As<Napi::TypedArray>().TypedArrayType() != napi_float64_array) {
      ThrowSpiceError(Napi::TypeError::New(env, "Expected owned SPK14 Float64Array"));
      return;
    }
  auto rows = info[2].As<Napi::Float64Array>(), epochs = info[3].As<Napi::Float64Array>();
  if (rows.ElementLength() > 33554432 || epochs.ElementLength() > 33554432) {
    ThrowSpiceError(Napi::RangeError::New(env, "SPK14 data exceeds 256 MiB"));
    return;
  }
  const double zero = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_spk14a(h, n, rows.ElementLength() ? rows.Data() : &zero, rows.ElementLength(),
                    epochs.ElementLength() ? epochs.Data() : &zero, epochs.ElementLength(), err,
                    sizeof(err)))
    ThrowSpiceError(env, "SPK14 add failed", err);
}
template <bool Dispose>
static void EndSpk14(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  int32_t h;
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected SPK14 handle"));
    return;
  }
  if (!ReadInt32Checked(env, info[0], "handle", &h)) return;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int code = Dispose ? tspice_spk14_finish_if_active(h, err, sizeof(err))
                     : tspice_spk14e(h, err, sizeof(err));
  if (code) ThrowSpiceError(env, "SPK14 end failed", err);
}

namespace tspice_backend_node {

void RegisterEphemeris(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "getelm", Napi::Function::New(env, Getelm), __func__)) return;
  if (!SetExportChecked(env, exports, "evsgp4", Napi::Function::New(env, Evsgp4), __func__)) return;
  if (!SetExportChecked(env, exports, "ckgp", Napi::Function::New(env, Ckgp), __func__)) return;
  if (!SetExportChecked(env, exports, "ckgpav", Napi::Function::New(env, Ckgpav), __func__)) return;
  if (!SetExportChecked(env, exports, "conics", Napi::Function::New(env, Conics), __func__)) return;
  if (!SetExportChecked(env, exports, "eqncpv", Napi::Function::New(env, Eqncpv), __func__)) return;
  if (!SetExportChecked(env, exports, "oscelt", Napi::Function::New(env, Oscelt), __func__)) return;
  if (!SetExportChecked(env, exports, "oscltx", Napi::Function::New(env, Oscltx), __func__)) return;
  if (!SetExportChecked(env, exports, "prop2b", Napi::Function::New(env, Prop2b), __func__)) return;
  if (!SetExportChecked(env, exports, "spkcpo", Napi::Function::New(env, Spkcpo), __func__)) return;
  if (!SetExportChecked(env, exports, "spkcpt", Napi::Function::New(env, Spkcpt), __func__)) return;
  if (!SetExportChecked(env, exports, "spkcvo", Napi::Function::New(env, Spkcvo), __func__)) return;
  if (!SetExportChecked(env, exports, "spkcvt", Napi::Function::New(env, Spkcvt), __func__)) return;
  if (!SetExportChecked(env, exports, "azlcpo", Napi::Function::New(env, Azlcpo), __func__)) return;
  if (!SetExportChecked(env, exports, "spkacs", Napi::Function::New(env, Spkacs), __func__)) return;
  if (!SetExportChecked(env, exports, "spkapo", Napi::Function::New(env, Spkapo), __func__)) return;
  if (!SetExportChecked(env, exports, "spkapp", Napi::Function::New(env, Spkapp), __func__)) return;
  if (!SetExportChecked(env, exports, "spkaps", Napi::Function::New(env, Spkaps), __func__)) return;
  if (!SetExportChecked(env, exports, "spkltc", Napi::Function::New(env, Spkltc), __func__)) return;
  if (!SetExportChecked(env, exports, "stelab", Napi::Function::New(env, Stelab), __func__)) return;
  if (!SetExportChecked(env, exports, "stlabx", Napi::Function::New(env, Stlabx), __func__)) return;
  if (!SetExportChecked(env, exports, "ltime", Napi::Function::New(env, Ltime), __func__)) return;
  if (!SetExportChecked(env, exports, "spkezr", Napi::Function::New(env, Spkezr), __func__)) return;
  if (!SetExportChecked(env, exports, "spkpos", Napi::Function::New(env, Spkpos), __func__)) return;
  if (!SetExportChecked(env, exports, "spkopn", Napi::Function::New(env, Spkopn), __func__)) return;
  if (!SetExportChecked(env, exports, "spkopa", Napi::Function::New(env, Spkopa), __func__)) return;
  if (!SetExportChecked(env, exports, "spkw02", Napi::Function::New(env, SpkChebyshevWriter<2>),
                        __func__))
    return;
  if (!SetExportChecked(env, exports, "spkw03", Napi::Function::New(env, SpkChebyshevWriter<3>),
                        __func__))
    return;
  if (!SetExportChecked(env, exports, "spkw20", Napi::Function::New(env, SpkChebyshevWriter<20>),
                        __func__))
    return;
  if (!SetExportChecked(env, exports, "spkw09", Napi::Function::New(env, SpkInterpolationWriter<9>),
                        __func__))
    return;
  if (!SetExportChecked(env, exports, "spkw12",
                        Napi::Function::New(env, SpkInterpolationWriter<12>), __func__))
    return;
  if (!SetExportChecked(env, exports, "spkw13",
                        Napi::Function::New(env, SpkInterpolationWriter<13>), __func__))
    return;
  if (!SetExportChecked(env, exports, "spkw18",
                        Napi::Function::New(env, SpkInterpolationWriter<18>), __func__))
    return;
  if (!SetExportChecked(env, exports, "spkw05", Napi::Function::New(env, WriteAnalyticSpk<5>),
                        __func__))
    return;
  if (!SetExportChecked(env, exports, "spkw10", Napi::Function::New(env, WriteAnalyticSpk<10>),
                        __func__))
    return;
  if (!SetExportChecked(env, exports, "spkw15", Napi::Function::New(env, WriteAnalyticSpk<15>),
                        __func__))
    return;
  if (!SetExportChecked(env, exports, "spkw17", Napi::Function::New(env, WriteAnalyticSpk<17>),
                        __func__))
    return;
  if (!SetExportChecked(env, exports, "spk14b", Napi::Function::New(env, BeginSpk14), __func__))
    return;
  if (!SetExportChecked(env, exports, "spk14a", Napi::Function::New(env, AddSpk14), __func__))
    return;
  if (!SetExportChecked(env, exports, "spk14e", Napi::Function::New(env, EndSpk14<false>),
                        __func__))
    return;
  if (!SetExportChecked(env, exports, "spk14FinishIfActive",
                        Napi::Function::New(env, EndSpk14<true>), __func__))
    return;
  if (!SetExportChecked(env, exports, "spkw08", Napi::Function::New(env, Spkw08), __func__)) return;
  if (!SetExportChecked(env, exports, "spkcls", Napi::Function::New(env, Spkcls), __func__)) return;

  if (!SetExportChecked(env, exports, "spkez", Napi::Function::New(env, Spkez), __func__)) return;
  if (!SetExportChecked(env, exports, "spkezp", Napi::Function::New(env, Spkezp), __func__)) return;
  if (!SetExportChecked(env, exports, "spkgeo", Napi::Function::New(env, Spkgeo), __func__)) return;
  if (!SetExportChecked(env, exports, "spkgps", Napi::Function::New(env, Spkgps), __func__)) return;
  if (!SetExportChecked(env, exports, "spkssb", Napi::Function::New(env, Spkssb), __func__)) return;

  if (!SetExportChecked(env, exports, "spkcov", Napi::Function::New(env, Spkcov), __func__)) return;
  if (!SetExportChecked(env, exports, "spkobj", Napi::Function::New(env, Spkobj), __func__)) return;
  if (!SetExportChecked(env, exports, "spklef", Napi::Function::New(env, Spklef), __func__)) return;
  if (!SetExportChecked(env, exports, "spkuef", Napi::Function::New(env, Spkuef), __func__)) return;
  if (!SetExportChecked(env, exports, "spkpvn", Napi::Function::New(env, Spkpvn), __func__)) return;
  if (!SetExportChecked(env, exports, "spksub", Napi::Function::New(env, Spksub), __func__)) return;
  if (!SetExportChecked(env, exports, "spksfs", Napi::Function::New(env, Spksfs), __func__)) return;
  if (!SetExportChecked(env, exports, "spkpds", Napi::Function::New(env, Spkpds), __func__)) return;
  if (!SetExportChecked(env, exports, "spkuds", Napi::Function::New(env, Spkuds), __func__)) return;
}

}  // namespace tspice_backend_node
