#include "coords_vectors.h"

#include <climits>
#include <cmath>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNumberArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static bool ReadFixedMatrix(Napi::Env env, const Napi::Value& value, size_t length, double* out, const char* label) {
  if (!tspice_backend_node::ReadNumberArrayFixed(env, value, length, out, label)) return false;
  for (size_t i = 0; i < length; i++) {
    if (!std::isfinite(out[i])) {
      ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must contain finite numbers"));
      return false;
    }
  }
  return true;
}

static bool JacobianNumber(Napi::Env env, const Napi::Value &value, double *result, const char *label) {
  if (value.IsNumber()) {
    *result = value.As<Napi::Number>().DoubleValue();
    if (std::isfinite(*result)) return true;
  }
  ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " requires a finite number"));
  return false;
}

static Napi::Value Dazldr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "dazldr expects 5 arguments"));
    return env.Undefined();
  }
  double x;
  if (!JacobianNumber(env, info[0], &x, "dazldr(x)")) return env.Undefined();
  double y;
  if (!JacobianNumber(env, info[1], &y, "dazldr(y)")) return env.Undefined();
  double z;
  if (!JacobianNumber(env, info[2], &z, "dazldr(z)")) return env.Undefined();
  if (!info[3].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env, "azccw must be a boolean"));
    return env.Undefined();
  }
  const bool azccw = info[3].As<Napi::Boolean>().Value();
  if (!info[4].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env, "elplsz must be a boolean"));
    return env.Undefined();
  }
  const bool elplsz = info[4].As<Napi::Boolean>().Value();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_dazldr(x, y, z, azccw, elplsz, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dazldr", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Dcyldr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "dcyldr expects 3 arguments"));
    return env.Undefined();
  }
  double x;
  if (!JacobianNumber(env, info[0], &x, "dcyldr(x)")) return env.Undefined();
  double y;
  if (!JacobianNumber(env, info[1], &y, "dcyldr(y)")) return env.Undefined();
  double z;
  if (!JacobianNumber(env, info[2], &z, "dcyldr(z)")) return env.Undefined();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_dcyldr(x, y, z, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dcyldr", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Dgeodr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "dgeodr expects 5 arguments"));
    return env.Undefined();
  }
  double x;
  if (!JacobianNumber(env, info[0], &x, "dgeodr(x)")) return env.Undefined();
  double y;
  if (!JacobianNumber(env, info[1], &y, "dgeodr(y)")) return env.Undefined();
  double z;
  if (!JacobianNumber(env, info[2], &z, "dgeodr(z)")) return env.Undefined();
  double re;
  if (!JacobianNumber(env, info[3], &re, "dgeodr(re)")) return env.Undefined();
  double f;
  if (!JacobianNumber(env, info[4], &f, "dgeodr(f)")) return env.Undefined();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_dgeodr(x, y, z, re, f, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dgeodr", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Dlatdr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "dlatdr expects 3 arguments"));
    return env.Undefined();
  }
  double x;
  if (!JacobianNumber(env, info[0], &x, "dlatdr(x)")) return env.Undefined();
  double y;
  if (!JacobianNumber(env, info[1], &y, "dlatdr(y)")) return env.Undefined();
  double z;
  if (!JacobianNumber(env, info[2], &z, "dlatdr(z)")) return env.Undefined();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_dlatdr(x, y, z, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dlatdr", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Dpgrdr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 6) {
    ThrowSpiceError(Napi::TypeError::New(env, "dpgrdr expects 6 arguments"));
    return env.Undefined();
  }
  if (!info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a body name"));
    return env.Undefined();
  }
  const std::string body = info[0].As<Napi::String>().Utf8Value();
  if (body.find('\0') != std::string::npos || body.size() > INT_MAX) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid CSPICE body name"));
    return env.Undefined();
  }
  double x;
  if (!JacobianNumber(env, info[1], &x, "dpgrdr(x)")) return env.Undefined();
  double y;
  if (!JacobianNumber(env, info[2], &y, "dpgrdr(y)")) return env.Undefined();
  double z;
  if (!JacobianNumber(env, info[3], &z, "dpgrdr(z)")) return env.Undefined();
  double re;
  if (!JacobianNumber(env, info[4], &re, "dpgrdr(re)")) return env.Undefined();
  double f;
  if (!JacobianNumber(env, info[5], &f, "dpgrdr(f)")) return env.Undefined();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_dpgrdr(body.c_str(), x, y, z, re, f, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dpgrdr", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Drdazl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "drdazl expects 5 arguments"));
    return env.Undefined();
  }
  double range;
  if (!JacobianNumber(env, info[0], &range, "drdazl(range)")) return env.Undefined();
  double az;
  if (!JacobianNumber(env, info[1], &az, "drdazl(az)")) return env.Undefined();
  double el;
  if (!JacobianNumber(env, info[2], &el, "drdazl(el)")) return env.Undefined();
  if (!info[3].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env, "azccw must be a boolean"));
    return env.Undefined();
  }
  const bool azccw = info[3].As<Napi::Boolean>().Value();
  if (!info[4].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env, "elplsz must be a boolean"));
    return env.Undefined();
  }
  const bool elplsz = info[4].As<Napi::Boolean>().Value();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_drdazl(range, az, el, azccw, elplsz, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling drdazl", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Drdcyl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "drdcyl expects 3 arguments"));
    return env.Undefined();
  }
  double radius;
  if (!JacobianNumber(env, info[0], &radius, "drdcyl(radius)")) return env.Undefined();
  double lon;
  if (!JacobianNumber(env, info[1], &lon, "drdcyl(lon)")) return env.Undefined();
  double z;
  if (!JacobianNumber(env, info[2], &z, "drdcyl(z)")) return env.Undefined();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_drdcyl(radius, lon, z, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling drdcyl", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Drdgeo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "drdgeo expects 5 arguments"));
    return env.Undefined();
  }
  double lon;
  if (!JacobianNumber(env, info[0], &lon, "drdgeo(lon)")) return env.Undefined();
  double lat;
  if (!JacobianNumber(env, info[1], &lat, "drdgeo(lat)")) return env.Undefined();
  double alt;
  if (!JacobianNumber(env, info[2], &alt, "drdgeo(alt)")) return env.Undefined();
  double re;
  if (!JacobianNumber(env, info[3], &re, "drdgeo(re)")) return env.Undefined();
  double f;
  if (!JacobianNumber(env, info[4], &f, "drdgeo(f)")) return env.Undefined();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_drdgeo(lon, lat, alt, re, f, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling drdgeo", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Drdlat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "drdlat expects 3 arguments"));
    return env.Undefined();
  }
  double radius;
  if (!JacobianNumber(env, info[0], &radius, "drdlat(radius)")) return env.Undefined();
  double lon;
  if (!JacobianNumber(env, info[1], &lon, "drdlat(lon)")) return env.Undefined();
  double lat;
  if (!JacobianNumber(env, info[2], &lat, "drdlat(lat)")) return env.Undefined();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_drdlat(radius, lon, lat, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling drdlat", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Drdpgr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 6) {
    ThrowSpiceError(Napi::TypeError::New(env, "drdpgr expects 6 arguments"));
    return env.Undefined();
  }
  if (!info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a body name"));
    return env.Undefined();
  }
  const std::string body = info[0].As<Napi::String>().Utf8Value();
  if (body.find('\0') != std::string::npos || body.size() > INT_MAX) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid CSPICE body name"));
    return env.Undefined();
  }
  double lon;
  if (!JacobianNumber(env, info[1], &lon, "drdpgr(lon)")) return env.Undefined();
  double lat;
  if (!JacobianNumber(env, info[2], &lat, "drdpgr(lat)")) return env.Undefined();
  double alt;
  if (!JacobianNumber(env, info[3], &alt, "drdpgr(alt)")) return env.Undefined();
  double re;
  if (!JacobianNumber(env, info[4], &re, "drdpgr(re)")) return env.Undefined();
  double f;
  if (!JacobianNumber(env, info[5], &f, "drdpgr(f)")) return env.Undefined();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_drdpgr(body.c_str(), lon, lat, alt, re, f, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling drdpgr", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Drdsph(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "drdsph expects 3 arguments"));
    return env.Undefined();
  }
  double radius;
  if (!JacobianNumber(env, info[0], &radius, "drdsph(radius)")) return env.Undefined();
  double colat;
  if (!JacobianNumber(env, info[1], &colat, "drdsph(colat)")) return env.Undefined();
  double lon;
  if (!JacobianNumber(env, info[2], &lon, "drdsph(lon)")) return env.Undefined();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_drdsph(radius, colat, lon, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling drdsph", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Value Dsphdr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "dsphdr expects 3 arguments"));
    return env.Undefined();
  }
  double x;
  if (!JacobianNumber(env, info[0], &x, "dsphdr(x)")) return env.Undefined();
  double y;
  if (!JacobianNumber(env, info[1], &y, "dsphdr(y)")) return env.Undefined();
  double z;
  if (!JacobianNumber(env, info[2], &z, "dsphdr(z)")) return env.Undefined();
  double out[9] = {0};
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_dsphdr(x, y, z, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dsphdr", err);
    return env.Undefined();
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Number Det(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "det() expects 1 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  double m[9] = {0.0};
  if (!ReadFixedMatrix(env, info[0], 9, m, "det(m)")) return Napi::Number::New(env, 0);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int status = tspice_det(m, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling det", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Object Diags2(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "diags2() expects 1 argument(s)"));
    return Napi::Object::New(env);
  }
  double symmat[4] = {0.0};
  if (!ReadFixedMatrix(env, info[0], 4, symmat, "diags2(symmat)")) return Napi::Object::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double diag[4] = {0.0};
  double rotate[4] = {0.0};
  const int status = tspice_diags2(symmat, diag, rotate, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling diags2", err);
    return Napi::Object::New(env);
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("diag", MakeNumberArray(env, diag, 4));
  result.Set("rotate", MakeNumberArray(env, rotate, 4));
  return result;
}

static Napi::Array Ident(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "ident() expects 0 argument(s)"));
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0.0};
  const int status = tspice_ident(out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ident", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Array Invert(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "invert() expects 1 argument(s)"));
    return Napi::Array::New(env);
  }
  double m[9] = {0.0};
  if (!ReadFixedMatrix(env, info[0], 9, m, "invert(m)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0.0};
  const int status = tspice_invert(m, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling invert", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Array Invort(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "invort() expects 1 argument(s)"));
    return Napi::Array::New(env);
  }
  double m[9] = {0.0};
  if (!ReadFixedMatrix(env, info[0], 9, m, "invort(m)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0.0};
  const int status = tspice_invort(m, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling invort", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Boolean Isrot(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "isrot() expects 3 argument(s)"));
    return Napi::Boolean::New(env, 0);
  }
  double m[9] = {0.0};
  if (!ReadFixedMatrix(env, info[0], 9, m, "isrot(m)")) return Napi::Boolean::New(env, 0);
  if (!info[1].IsNumber() || !std::isfinite(info[1].As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, "isrot(ntol) must be a finite number"));
    return Napi::Boolean::New(env, 0);
  }
  const double ntol = info[1].As<Napi::Number>().DoubleValue();
  if (!info[2].IsNumber() || !std::isfinite(info[2].As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, "isrot(dtol) must be a finite number"));
    return Napi::Boolean::New(env, 0);
  }
  const double dtol = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = 0;
  const int status = tspice_isrot(m, ntol, dtol, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling isrot", err);
    return Napi::Boolean::New(env, 0);
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Array Mequ(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "mequ() expects 1 argument(s)"));
    return Napi::Array::New(env);
  }
  double m[9] = {0.0};
  if (!ReadFixedMatrix(env, info[0], 9, m, "mequ(m)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0.0};
  const int status = tspice_mequ(m, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mequ", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Array Mtxm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "mtxm() expects 2 argument(s)"));
    return Napi::Array::New(env);
  }
  double a[9] = {0.0};
  if (!ReadFixedMatrix(env, info[0], 9, a, "mtxm(a)")) return Napi::Array::New(env);
  double b[9] = {0.0};
  if (!ReadFixedMatrix(env, info[1], 9, b, "mtxm(b)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0.0};
  const int status = tspice_mtxm(a, b, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mtxm", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Array Mxmt(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "mxmt() expects 2 argument(s)"));
    return Napi::Array::New(env);
  }
  double a[9] = {0.0};
  if (!ReadFixedMatrix(env, info[0], 9, a, "mxmt(a)")) return Napi::Array::New(env);
  double b[9] = {0.0};
  if (!ReadFixedMatrix(env, info[1], 9, b, "mxmt(b)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0.0};
  const int status = tspice_mxmt(a, b, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mxmt", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 9);
}

static Napi::Number Trace(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "trace() expects 1 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  double m[9] = {0.0};
  if (!ReadFixedMatrix(env, info[0], 9, m, "trace(m)")) return Napi::Number::New(env, 0);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int status = tspice_trace(m, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling trace", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Array Xpose(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "xpose() expects 1 argument(s)"));
    return Napi::Array::New(env);
  }
  double m[9] = {0.0};
  if (!ReadFixedMatrix(env, info[0], 9, m, "xpose(m)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0.0};
  const int status = tspice_xpose(m, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling xpose", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 9);
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
  if (!SetExportChecked(env, exports, "dazldr", Napi::Function::New(env, Dazldr), __func__)) return;
  if (!SetExportChecked(env, exports, "dcyldr", Napi::Function::New(env, Dcyldr), __func__)) return;
  if (!SetExportChecked(env, exports, "dgeodr", Napi::Function::New(env, Dgeodr), __func__)) return;
  if (!SetExportChecked(env, exports, "dlatdr", Napi::Function::New(env, Dlatdr), __func__)) return;
  if (!SetExportChecked(env, exports, "dpgrdr", Napi::Function::New(env, Dpgrdr), __func__)) return;
  if (!SetExportChecked(env, exports, "drdazl", Napi::Function::New(env, Drdazl), __func__)) return;
  if (!SetExportChecked(env, exports, "drdcyl", Napi::Function::New(env, Drdcyl), __func__)) return;
  if (!SetExportChecked(env, exports, "drdgeo", Napi::Function::New(env, Drdgeo), __func__)) return;
  if (!SetExportChecked(env, exports, "drdlat", Napi::Function::New(env, Drdlat), __func__)) return;
  if (!SetExportChecked(env, exports, "drdpgr", Napi::Function::New(env, Drdpgr), __func__)) return;
  if (!SetExportChecked(env, exports, "drdsph", Napi::Function::New(env, Drdsph), __func__)) return;
  if (!SetExportChecked(env, exports, "dsphdr", Napi::Function::New(env, Dsphdr), __func__)) return;
  if (!SetExportChecked(env, exports, "det", Napi::Function::New(env, Det), __func__)) return;
  if (!SetExportChecked(env, exports, "diags2", Napi::Function::New(env, Diags2), __func__)) return;
  if (!SetExportChecked(env, exports, "ident", Napi::Function::New(env, Ident), __func__)) return;
  if (!SetExportChecked(env, exports, "invert", Napi::Function::New(env, Invert), __func__)) return;
  if (!SetExportChecked(env, exports, "invort", Napi::Function::New(env, Invort), __func__)) return;
  if (!SetExportChecked(env, exports, "isrot", Napi::Function::New(env, Isrot), __func__)) return;
  if (!SetExportChecked(env, exports, "mequ", Napi::Function::New(env, Mequ), __func__)) return;
  if (!SetExportChecked(env, exports, "mtxm", Napi::Function::New(env, Mtxm), __func__)) return;
  if (!SetExportChecked(env, exports, "mxmt", Napi::Function::New(env, Mxmt), __func__)) return;
  if (!SetExportChecked(env, exports, "trace", Napi::Function::New(env, Trace), __func__)) return;
  if (!SetExportChecked(env, exports, "xpose", Napi::Function::New(env, Xpose), __func__)) return;
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
