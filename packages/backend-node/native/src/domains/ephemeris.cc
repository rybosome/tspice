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

  const int code = tspice_spksfs(body, et, &handle, descr, ident, (int)sizeof(ident), &found, err, (int)sizeof(err));
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

namespace tspice_backend_node {

void RegisterEphemeris(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "getelm", Napi::Function::New(env, Getelm), __func__)) return;
  if (!SetExportChecked(env, exports, "evsgp4", Napi::Function::New(env, Evsgp4), __func__)) return;
  if (!SetExportChecked(env, exports, "ckgp", Napi::Function::New(env, Ckgp), __func__)) return;
  if (!SetExportChecked(env, exports, "ckgpav", Napi::Function::New(env, Ckgpav), __func__)) return;
  if (!SetExportChecked(env, exports, "spkezr", Napi::Function::New(env, Spkezr), __func__)) return;
  if (!SetExportChecked(env, exports, "spkpos", Napi::Function::New(env, Spkpos), __func__)) return;
  if (!SetExportChecked(env, exports, "spkopn", Napi::Function::New(env, Spkopn), __func__)) return;
  if (!SetExportChecked(env, exports, "spkopa", Napi::Function::New(env, Spkopa), __func__)) return;
  if (!SetExportChecked(env, exports, "spkw08", Napi::Function::New(env, Spkw08), __func__)) return;
  if (!SetExportChecked(env, exports, "spkcls", Napi::Function::New(env, Spkcls), __func__)) return;

  if (!SetExportChecked(env, exports, "spkez", Napi::Function::New(env, Spkez), __func__)) return;
  if (!SetExportChecked(env, exports, "spkezp", Napi::Function::New(env, Spkezp), __func__)) return;
  if (!SetExportChecked(env, exports, "spkgeo", Napi::Function::New(env, Spkgeo), __func__)) return;
  if (!SetExportChecked(env, exports, "spkgps", Napi::Function::New(env, Spkgps), __func__)) return;
  if (!SetExportChecked(env, exports, "spkssb", Napi::Function::New(env, Spkssb), __func__)) return;

  if (!SetExportChecked(env, exports, "spkcov", Napi::Function::New(env, Spkcov), __func__)) return;
  if (!SetExportChecked(env, exports, "spkobj", Napi::Function::New(env, Spkobj), __func__)) return;
  if (!SetExportChecked(env, exports, "spksfs", Napi::Function::New(env, Spksfs), __func__)) return;
  if (!SetExportChecked(env, exports, "spkpds", Napi::Function::New(env, Spkpds), __func__)) return;
  if (!SetExportChecked(env, exports, "spkuds", Napi::Function::New(env, Spkuds), __func__)) return;
}

}  // namespace tspice_backend_node
