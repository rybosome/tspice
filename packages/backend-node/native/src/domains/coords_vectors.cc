#include "coords_vectors.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNumberArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static bool ReadInterpolationNumber(Napi::Env env, const Napi::Value& value, double* out, const char* label) {
  if (!value.IsNumber() || !std::isfinite(value.As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a finite number"));
    return false;
  }
  *out = value.As<Napi::Number>().DoubleValue();
  return true;
}

static bool ReadInterpolationCount(Napi::Env env, const Napi::Value& value, uint32_t stride, uint32_t maximum, int* count, const char* label) {
  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be an array"));
    return false;
  }
  const uint32_t length = value.As<Napi::Array>().Length();
  if (length % stride != 0 || length / stride > maximum || static_cast<size_t>(length) > SIZE_MAX / sizeof(double)) {
    ThrowSpiceError(Napi::RangeError::New(env, std::string(label) + " has an unsupported point count or layout"));
    return false;
  }
  *count = static_cast<int>(length / stride);
  return true;
}

static bool ReadInterpolationValues(Napi::Env env, const Napi::Value& value, uint32_t length, std::vector<double>& out, const char* label) {
  // Copy the exact validated size even if an earlier input accessor resized
  // this array. Missing entries then fail before any pointer reaches CSPICE.
  const Napi::Array array = value.As<Napi::Array>();
  out.resize(std::max<size_t>(1, length), 0.0);
  for (uint32_t i = 0; i < length; i++) {
    if (!ReadInterpolationNumber(env, array.Get(i), &out[i], label)) return false;
  }
  return true;
}

static Napi::Object Hrmesp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "hrmesp() expects 4 arguments"));
    return Napi::Object::New(env);
  }
  int count = 0;
  if (!ReadInterpolationCount(env, info[2], 2U, 67108863U, &count, "hrmesp(yvals)")) return Napi::Object::New(env);
  if (static_cast<size_t>(count) > SIZE_MAX / (4 * sizeof(double))) {
    ThrowSpiceError(Napi::RangeError::New(env, "Interpolation workspace is too large"));
    return Napi::Object::New(env);
  }
  double first = 0.0;
  if (!ReadInterpolationNumber(env, info[0], &first, "hrmesp(first)")) return Napi::Object::New(env);
  double step = 0.0;
  if (!ReadInterpolationNumber(env, info[1], &step, "hrmesp(step)")) return Napi::Object::New(env);
  std::vector<double> yvals;
  if (!ReadInterpolationValues(env, info[2], 2U * static_cast<uint32_t>(count), yvals, "hrmesp(yvals)")) return Napi::Object::New(env);
  double x = 0.0;
  if (!ReadInterpolationNumber(env, info[3], &x, "hrmesp(x)")) return Napi::Object::New(env);
  double value = 0.0;
  double derivative = 0.0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_hrmesp(count, first, step, yvals.data(), x, &value, &derivative, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling hrmesp", err);
    return Napi::Object::New(env);
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("f", Napi::Number::New(env, value));
  result.Set("df", Napi::Number::New(env, derivative));
  return result;
}

static Napi::Object Hrmint(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "hrmint() expects 3 arguments"));
    return Napi::Object::New(env);
  }
  int count = 0;
  if (!ReadInterpolationCount(env, info[0], 1U, 357913941U, &count, "hrmint(xvals)")) return Napi::Object::New(env);
  int otherCount = 0;
  if (!ReadInterpolationCount(env, info[1], 2U, 357913941U, &otherCount, "hrmint(yvals)")) return Napi::Object::New(env);
  if (otherCount != count) {
    ThrowSpiceError(Napi::RangeError::New(env, "hrmint() input array lengths do not match"));
    return Napi::Object::New(env);
  }
  if (static_cast<size_t>(count) > SIZE_MAX / (4 * sizeof(double))) {
    ThrowSpiceError(Napi::RangeError::New(env, "Interpolation workspace is too large"));
    return Napi::Object::New(env);
  }
  std::vector<double> xvals;
  if (!ReadInterpolationValues(env, info[0], static_cast<uint32_t>(count), xvals, "hrmint(xvals)")) return Napi::Object::New(env);
  std::vector<double> yvals;
  if (!ReadInterpolationValues(env, info[1], 2U * static_cast<uint32_t>(count), yvals, "hrmint(yvals)")) return Napi::Object::New(env);
  double x = 0.0;
  if (!ReadInterpolationNumber(env, info[2], &x, "hrmint(x)")) return Napi::Object::New(env);
  double value = 0.0;
  double derivative = 0.0;
  std::vector<double> work(std::max<size_t>(1, 4 * static_cast<size_t>(count)), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_hrmint(count, xvals.data(), yvals.data(), x, work.data(), &value, &derivative, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling hrmint", err);
    return Napi::Object::New(env);
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("f", Napi::Number::New(env, value));
  result.Set("df", Napi::Number::New(env, derivative));
  return result;
}

static Napi::Number Lgresp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "lgresp() expects 4 arguments"));
    return Napi::Number::New(env, 0);
  }
  int count = 0;
  if (!ReadInterpolationCount(env, info[2], 1U, 268435455U, &count, "lgresp(yvals)")) return Napi::Number::New(env, 0);
  if (static_cast<size_t>(count) > SIZE_MAX / (1 * sizeof(double))) {
    ThrowSpiceError(Napi::RangeError::New(env, "Interpolation workspace is too large"));
    return Napi::Number::New(env, 0);
  }
  double first = 0.0;
  if (!ReadInterpolationNumber(env, info[0], &first, "lgresp(first)")) return Napi::Number::New(env, 0);
  double step = 0.0;
  if (!ReadInterpolationNumber(env, info[1], &step, "lgresp(step)")) return Napi::Number::New(env, 0);
  std::vector<double> yvals;
  if (!ReadInterpolationValues(env, info[2], static_cast<uint32_t>(count), yvals, "lgresp(yvals)")) return Napi::Number::New(env, 0);
  double x = 0.0;
  if (!ReadInterpolationNumber(env, info[3], &x, "lgresp(x)")) return Napi::Number::New(env, 0);
  double out = 0.0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_lgresp(count, first, step, yvals.data(), x, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lgresp", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Object Lgrind(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "lgrind() expects 3 arguments"));
    return Napi::Object::New(env);
  }
  int count = 0;
  if (!ReadInterpolationCount(env, info[0], 1U, 715827882U, &count, "lgrind(xvals)")) return Napi::Object::New(env);
  int otherCount = 0;
  if (!ReadInterpolationCount(env, info[1], 1U, 715827882U, &otherCount, "lgrind(yvals)")) return Napi::Object::New(env);
  if (otherCount != count) {
    ThrowSpiceError(Napi::RangeError::New(env, "lgrind() input array lengths do not match"));
    return Napi::Object::New(env);
  }
  if (static_cast<size_t>(count) > SIZE_MAX / (2 * sizeof(double))) {
    ThrowSpiceError(Napi::RangeError::New(env, "Interpolation workspace is too large"));
    return Napi::Object::New(env);
  }
  std::vector<double> xvals;
  if (!ReadInterpolationValues(env, info[0], static_cast<uint32_t>(count), xvals, "lgrind(xvals)")) return Napi::Object::New(env);
  std::vector<double> yvals;
  if (!ReadInterpolationValues(env, info[1], static_cast<uint32_t>(count), yvals, "lgrind(yvals)")) return Napi::Object::New(env);
  double x = 0.0;
  if (!ReadInterpolationNumber(env, info[2], &x, "lgrind(x)")) return Napi::Object::New(env);
  double value = 0.0;
  double derivative = 0.0;
  std::vector<double> work(std::max<size_t>(1, 2 * static_cast<size_t>(count)), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_lgrind(count, xvals.data(), yvals.data(), work.data(), x, &value, &derivative, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lgrind", err);
    return Napi::Object::New(env);
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("p", Napi::Number::New(env, value));
  result.Set("dp", Napi::Number::New(env, derivative));
  return result;
}

static Napi::Number Lgrint(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "lgrint() expects 3 arguments"));
    return Napi::Number::New(env, 0);
  }
  int count = 0;
  if (!ReadInterpolationCount(env, info[0], 1U, 268435455U, &count, "lgrint(xvals)")) return Napi::Number::New(env, 0);
  int otherCount = 0;
  if (!ReadInterpolationCount(env, info[1], 1U, 268435455U, &otherCount, "lgrint(yvals)")) return Napi::Number::New(env, 0);
  if (otherCount != count) {
    ThrowSpiceError(Napi::RangeError::New(env, "lgrint() input array lengths do not match"));
    return Napi::Number::New(env, 0);
  }
  if (static_cast<size_t>(count) > SIZE_MAX / (1 * sizeof(double))) {
    ThrowSpiceError(Napi::RangeError::New(env, "Interpolation workspace is too large"));
    return Napi::Number::New(env, 0);
  }
  std::vector<double> xvals;
  if (!ReadInterpolationValues(env, info[0], static_cast<uint32_t>(count), xvals, "lgrint(xvals)")) return Napi::Number::New(env, 0);
  std::vector<double> yvals;
  if (!ReadInterpolationValues(env, info[1], static_cast<uint32_t>(count), yvals, "lgrint(yvals)")) return Napi::Number::New(env, 0);
  double x = 0.0;
  if (!ReadInterpolationNumber(env, info[2], &x, "lgrint(x)")) return Napi::Number::New(env, 0);
  double out = 0.0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_lgrint(count, xvals.data(), yvals.data(), x, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lgrint", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Array Qderiv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "qderiv() expects 3 arguments"));
    return Napi::Array::New(env);
  }
  int count = 0;
  if (!ReadInterpolationCount(env, info[0], 1U, 2147483646U, &count, "qderiv(f0)")) return Napi::Array::New(env);
  int otherCount = 0;
  if (!ReadInterpolationCount(env, info[1], 1U, 2147483646U, &otherCount, "qderiv(f2)")) return Napi::Array::New(env);
  if (otherCount != count) {
    ThrowSpiceError(Napi::RangeError::New(env, "qderiv() input array lengths do not match"));
    return Napi::Array::New(env);
  }
  if (count == 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "qderiv() requires nonempty arrays"));
    return Napi::Array::New(env);
  }
  if (static_cast<size_t>(count) > SIZE_MAX / (1 * sizeof(double))) {
    ThrowSpiceError(Napi::RangeError::New(env, "Interpolation workspace is too large"));
    return Napi::Array::New(env);
  }
  std::vector<double> f0;
  if (!ReadInterpolationValues(env, info[0], static_cast<uint32_t>(count), f0, "qderiv(f0)")) return Napi::Array::New(env);
  std::vector<double> f2;
  if (!ReadInterpolationValues(env, info[1], static_cast<uint32_t>(count), f2, "qderiv(f2)")) return Napi::Array::New(env);
  double delta = 0.0;
  if (!ReadInterpolationNumber(env, info[2], &delta, "qderiv(delta)")) return Napi::Array::New(env);
  std::vector<double> out(static_cast<size_t>(count), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_qderiv(count, f0.data(), f2.data(), delta, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling qderiv", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out.data(), static_cast<size_t>(count));
}

static Napi::Object Reclat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "reclat(rect: number[3]) expects 1 argument"));
    return Napi::Object::New(env);
  }

  double rect[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], rect, "rect")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double radius = 0.0;
  double lon = 0.0;
  double lat = 0.0;
  const int code = tspice_reclat(rect, &radius, &lon, &lat, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling reclat", err);
    return Napi::Object::New(env);
  }

  Napi::Object out = Napi::Object::New(env);
  out.Set("radius", Napi::Number::New(env, radius));
  out.Set("lon", Napi::Number::New(env, lon));
  out.Set("lat", Napi::Number::New(env, lat));
  return out;
}

static Napi::Array Latrec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "latrec(radius: number, lon: number, lat: number) expects (number, number, number)"));
    return Napi::Array::New(env);
  }

  const double radius = info[0].As<Napi::Number>().DoubleValue();
  const double lon = info[1].As<Napi::Number>().DoubleValue();
  const double lat = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double rect[3] = {0};
  const int code = tspice_latrec(radius, lon, lat, rect, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling latrec", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, rect, 3);
}

static Napi::Object Recsph(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "recsph(rect: number[3]) expects 1 argument"));
    return Napi::Object::New(env);
  }

  double rect[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], rect, "rect")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double radius = 0.0;
  double colat = 0.0;
  double lon = 0.0;
  const int code = tspice_recsph(rect, &radius, &colat, &lon, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling recsph", err);
    return Napi::Object::New(env);
  }

  Napi::Object out = Napi::Object::New(env);
  out.Set("radius", Napi::Number::New(env, radius));
  out.Set("colat", Napi::Number::New(env, colat));
  out.Set("lon", Napi::Number::New(env, lon));
  return out;
}

static Napi::Array Sphrec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "sphrec(radius: number, colat: number, lon: number) expects (number, number, number)"));
    return Napi::Array::New(env);
  }

  const double radius = info[0].As<Napi::Number>().DoubleValue();
  const double colat = info[1].As<Napi::Number>().DoubleValue();
  const double lon = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double rect[3] = {0};
  const int code = tspice_sphrec(radius, colat, lon, rect, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sphrec", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, rect, 3);
}

static Napi::Number Vnorm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vnorm(v: number[3]) expects 1 argument"));
    return Napi::Number::New(env, 0);
  }

  double v[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], v, "v")) {
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int code = tspice_vnorm(v, &out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vnorm", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, out);
}

static Napi::Array Vhat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vhat(v: number[3]) expects 1 argument"));
    return Napi::Array::New(env);
  }

  double v[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vhat(v, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vhat", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Number Vdot(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vdot(a: number[3], b: number[3]) expects 2 arguments"));
    return Napi::Number::New(env, 0);
  }

  double a[3] = {0};
  double b[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], a, "a")) {
    return Napi::Number::New(env, 0);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], b, "b")) {
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int code = tspice_vdot(a, b, &out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vdot", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, out);
}

static Napi::Array Vcrss(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vcrss(a: number[3], b: number[3]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double a[3] = {0};
  double b[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], a, "a")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], b, "b")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vcrss(a, b, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vcrss", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Mxv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "mxv(m: number[9], v: number[3]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double m[9] = {0};
  double v[3] = {0};
  if (!tspice_backend_node::ReadMat33RowMajor(env, info[0], m, "m")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_mxv(m, v, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mxv", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Mtxv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "mtxv(m: number[9], v: number[3]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double m[9] = {0};
  double v[3] = {0};
  if (!tspice_backend_node::ReadMat33RowMajor(env, info[0], m, "m")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_mtxv(m, v, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mtxv", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}


static Napi::Array Vadd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vadd(a: number[3], b: number[3]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double a[3] = {0};
  double b[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], a, "a")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], b, "b")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vadd(a, b, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vadd", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Vsub(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vsub(a: number[3], b: number[3]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double a[3] = {0};
  double b[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], a, "a")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], b, "b")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vsub(a, b, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vsub", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Vminus(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vminus(v: number[3]) expects 1 argument"));
    return Napi::Array::New(env);
  }

  double v[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vminus(v, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vminus", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Vscl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "vscl(s: number, v: number[3]) expects (number, number[3])"));
    return Napi::Array::New(env);
  }

  const double s = info[0].As<Napi::Number>().DoubleValue();

  double v[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[1], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vscl(s, v, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vscl", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Mxm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "mxm(a: number[9], b: number[9]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double a[9] = {0};
  double b[9] = {0};
  if (!tspice_backend_node::ReadMat33RowMajor(env, info[0], a, "a")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadMat33RowMajor(env, info[1], b, "b")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0};
  const int code = tspice_mxm(a, b, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mxm", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 9);
}

static Napi::Array Rotate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "rotate(angle: number, axis: number) expects (number, number)"));
    return Napi::Array::New(env);
  }

  const double angle = info[0].As<Napi::Number>().DoubleValue();
  const int axis = info[1].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0};
  const int code = tspice_rotate(angle, axis, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling rotate", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 9);
}

static Napi::Array Rotmat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "rotmat(m: number[9], angle: number, axis: number) expects (number[9], number, number)"));
    return Napi::Array::New(env);
  }

  double m[9] = {0};
  if (!tspice_backend_node::ReadMat33RowMajor(env, info[0], m, "m")) {
    return Napi::Array::New(env);
  }

  const double angle = info[1].As<Napi::Number>().DoubleValue();
  const int axis = info[2].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0};
  const int code = tspice_rotmat(m, angle, axis, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling rotmat", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 9);
}

static Napi::Array Axisar(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "axisar(axis: number[3], angle: number) expects (number[3], number)"));
    return Napi::Array::New(env);
  }

  double axisVec[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], axisVec, "axis")) {
    return Napi::Array::New(env);
  }

  const double angle = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0};
  const int code = tspice_axisar(axisVec, angle, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling axisar", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 9);
}

static Napi::Array Georec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber() ||
      !info[3].IsNumber() || !info[4].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "georec(lon: number, lat: number, alt: number, re: number, f: number) expects 5 numbers"));
    return Napi::Array::New(env);
  }

  const double lon = info[0].As<Napi::Number>().DoubleValue();
  const double lat = info[1].As<Napi::Number>().DoubleValue();
  const double alt = info[2].As<Napi::Number>().DoubleValue();
  const double re = info[3].As<Napi::Number>().DoubleValue();
  const double f = info[4].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_georec(lon, lat, alt, re, f, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling georec", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Object Recgeo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "recgeo(rect: number[3], re: number, f: number) expects (number[3], number, number)"));
    return Napi::Object::New(env);
  }

  double rect[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], rect, "rect")) {
    return Napi::Object::New(env);
  }

  const double re = info[1].As<Napi::Number>().DoubleValue();
  const double f = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double lon = 0.0;
  double lat = 0.0;
  double alt = 0.0;
  const int code = tspice_recgeo(rect, re, f, &lon, &lat, &alt, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling recgeo", err);
    return Napi::Object::New(env);
  }

  Napi::Object out = Napi::Object::New(env);
  out.Set("lon", Napi::Number::New(env, lon));
  out.Set("lat", Napi::Number::New(env, lat));
  out.Set("alt", Napi::Number::New(env, alt));
  return out;
}

namespace tspice_backend_node {

void RegisterCoordsVectors(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "hrmesp", Napi::Function::New(env, Hrmesp), __func__)) return;
  if (!SetExportChecked(env, exports, "hrmint", Napi::Function::New(env, Hrmint), __func__)) return;
  if (!SetExportChecked(env, exports, "lgresp", Napi::Function::New(env, Lgresp), __func__)) return;
  if (!SetExportChecked(env, exports, "lgrind", Napi::Function::New(env, Lgrind), __func__)) return;
  if (!SetExportChecked(env, exports, "lgrint", Napi::Function::New(env, Lgrint), __func__)) return;
  if (!SetExportChecked(env, exports, "qderiv", Napi::Function::New(env, Qderiv), __func__)) return;
  if (!SetExportChecked(env, exports, "reclat", Napi::Function::New(env, Reclat), __func__)) return;
  if (!SetExportChecked(env, exports, "latrec", Napi::Function::New(env, Latrec), __func__)) return;
  if (!SetExportChecked(env, exports, "recsph", Napi::Function::New(env, Recsph), __func__)) return;
  if (!SetExportChecked(env, exports, "sphrec", Napi::Function::New(env, Sphrec), __func__)) return;

  if (!SetExportChecked(env, exports, "vnorm", Napi::Function::New(env, Vnorm), __func__)) return;
  if (!SetExportChecked(env, exports, "vhat", Napi::Function::New(env, Vhat), __func__)) return;
  if (!SetExportChecked(env, exports, "vdot", Napi::Function::New(env, Vdot), __func__)) return;
  if (!SetExportChecked(env, exports, "vcrss", Napi::Function::New(env, Vcrss), __func__)) return;
  if (!SetExportChecked(env, exports, "mxv", Napi::Function::New(env, Mxv), __func__)) return;
  if (!SetExportChecked(env, exports, "mtxv", Napi::Function::New(env, Mtxv), __func__)) return;
  if (!SetExportChecked(env, exports, "vadd", Napi::Function::New(env, Vadd), __func__)) return;
  if (!SetExportChecked(env, exports, "vsub", Napi::Function::New(env, Vsub), __func__)) return;
  if (!SetExportChecked(env, exports, "vminus", Napi::Function::New(env, Vminus), __func__)) return;
  if (!SetExportChecked(env, exports, "vscl", Napi::Function::New(env, Vscl), __func__)) return;
  if (!SetExportChecked(env, exports, "mxm", Napi::Function::New(env, Mxm), __func__)) return;
  if (!SetExportChecked(env, exports, "rotate", Napi::Function::New(env, Rotate), __func__)) return;
  if (!SetExportChecked(env, exports, "rotmat", Napi::Function::New(env, Rotmat), __func__)) return;
  if (!SetExportChecked(env, exports, "axisar", Napi::Function::New(env, Axisar), __func__)) return;
  if (!SetExportChecked(env, exports, "georec", Napi::Function::New(env, Georec), __func__)) return;
  if (!SetExportChecked(env, exports, "recgeo", Napi::Function::New(env, Recgeo), __func__)) return;
}

}  // namespace tspice_backend_node
