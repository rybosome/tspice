#include "coords_vectors.h"

#include <cmath>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNumberArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static bool ReadCombinationScalar(Napi::Env env, const Napi::Value& value, double* out, const char* label) {
  if (!value.IsNumber() || !std::isfinite(value.As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a finite number"));
    return false;
  }
  *out = value.As<Napi::Number>().DoubleValue();
  return true;
}

static bool ReadCombinationArray(Napi::Env env, const Napi::Value& value, size_t length, double* out, const char* label) {
  if (!tspice_backend_node::ReadNumberArrayFixed(env, value, length, out, label)) return false;
  for (size_t i = 0; i < length; i++) {
    if (!std::isfinite(out[i])) {
      ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must contain finite numbers"));
      return false;
    }
  }
  return true;
}

static bool ReadCombinationAxis(Napi::Env env, const Napi::Value& value, int* out) {
  double axis = 0.0;
  if (!ReadCombinationScalar(env, value, &axis, "rotvec(axis)")) return false;
  if (std::trunc(axis) != axis) {
    ThrowSpiceError(Napi::TypeError::New(env, "rotvec(axis) must be an integer"));
    return false;
  }
  if (axis < -2147483648.0 || axis > 2147483647.0) {
    ThrowSpiceError(Napi::RangeError::New(env, "rotvec(axis) must be a 32-bit signed integer"));
    return false;
  }
  *out = static_cast<int>(axis);
  return true;
}

static Napi::Array Vlcom(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "vlcom() expects 4 argument(s)"));
    return Napi::Array::New(env);
  }
  double a = 0.0;
  if (!ReadCombinationScalar(env, info[0], &a, "vlcom(a)")) return Napi::Array::New(env);
  double v1[3] = {0.0};
  if (!ReadCombinationArray(env, info[1], 3, v1, "vlcom(v1)")) return Napi::Array::New(env);
  double b = 0.0;
  if (!ReadCombinationScalar(env, info[2], &b, "vlcom(b)")) return Napi::Array::New(env);
  double v2[3] = {0.0};
  if (!ReadCombinationArray(env, info[3], 3, v2, "vlcom(v2)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0.0};
  const int status = tspice_vlcom(a, v1, b, v2, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vlcom", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 3);
}

static Napi::Array Vlcom3(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 6) {
    ThrowSpiceError(Napi::TypeError::New(env, "vlcom3() expects 6 argument(s)"));
    return Napi::Array::New(env);
  }
  double a = 0.0;
  if (!ReadCombinationScalar(env, info[0], &a, "vlcom3(a)")) return Napi::Array::New(env);
  double v1[3] = {0.0};
  if (!ReadCombinationArray(env, info[1], 3, v1, "vlcom3(v1)")) return Napi::Array::New(env);
  double b = 0.0;
  if (!ReadCombinationScalar(env, info[2], &b, "vlcom3(b)")) return Napi::Array::New(env);
  double v2[3] = {0.0};
  if (!ReadCombinationArray(env, info[3], 3, v2, "vlcom3(v2)")) return Napi::Array::New(env);
  double c = 0.0;
  if (!ReadCombinationScalar(env, info[4], &c, "vlcom3(c)")) return Napi::Array::New(env);
  double v3[3] = {0.0};
  if (!ReadCombinationArray(env, info[5], 3, v3, "vlcom3(v3)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0.0};
  const int status = tspice_vlcom3(a, v1, b, v2, c, v3, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vlcom3", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 3);
}

static Napi::Array Vperp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vperp() expects 2 argument(s)"));
    return Napi::Array::New(env);
  }
  double a[3] = {0.0};
  if (!ReadCombinationArray(env, info[0], 3, a, "vperp(a)")) return Napi::Array::New(env);
  double b[3] = {0.0};
  if (!ReadCombinationArray(env, info[1], 3, b, "vperp(b)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0.0};
  const int status = tspice_vperp(a, b, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vperp", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 3);
}

static Napi::Array Vproj(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vproj() expects 2 argument(s)"));
    return Napi::Array::New(env);
  }
  double a[3] = {0.0};
  if (!ReadCombinationArray(env, info[0], 3, a, "vproj(a)")) return Napi::Array::New(env);
  double b[3] = {0.0};
  if (!ReadCombinationArray(env, info[1], 3, b, "vproj(b)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0.0};
  const int status = tspice_vproj(a, b, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vproj", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 3);
}

static Napi::Number Vrel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vrel() expects 2 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  double a[3] = {0.0};
  if (!ReadCombinationArray(env, info[0], 3, a, "vrel(a)")) return Napi::Number::New(env, 0);
  double b[3] = {0.0};
  if (!ReadCombinationArray(env, info[1], 3, b, "vrel(b)")) return Napi::Number::New(env, 0);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int status = tspice_vrel(a, b, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vrel", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Array Vrotv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "vrotv() expects 3 argument(s)"));
    return Napi::Array::New(env);
  }
  double v[3] = {0.0};
  if (!ReadCombinationArray(env, info[0], 3, v, "vrotv(v)")) return Napi::Array::New(env);
  double axis[3] = {0.0};
  if (!ReadCombinationArray(env, info[1], 3, axis, "vrotv(axis)")) return Napi::Array::New(env);
  double theta = 0.0;
  if (!ReadCombinationScalar(env, info[2], &theta, "vrotv(theta)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0.0};
  const int status = tspice_vrotv(v, axis, theta, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vrotv", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 3);
}

static Napi::Array Rotvec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "rotvec() expects 3 argument(s)"));
    return Napi::Array::New(env);
  }
  double v[3] = {0.0};
  if (!ReadCombinationArray(env, info[0], 3, v, "rotvec(v)")) return Napi::Array::New(env);
  double angle = 0.0;
  if (!ReadCombinationScalar(env, info[1], &angle, "rotvec(angle)")) return Napi::Array::New(env);
  int axis = 0;
  if (!ReadCombinationAxis(env, info[2], &axis)) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0.0};
  const int status = tspice_rotvec(v, angle, axis, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling rotvec", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 3);
}

static Napi::Number Vtmv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "vtmv() expects 3 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  double v1[3] = {0.0};
  if (!ReadCombinationArray(env, info[0], 3, v1, "vtmv(v1)")) return Napi::Number::New(env, 0);
  double matrix[9] = {0.0};
  if (!ReadCombinationArray(env, info[1], 9, matrix, "vtmv(matrix)")) return Napi::Number::New(env, 0);
  double v2[3] = {0.0};
  if (!ReadCombinationArray(env, info[2], 3, v2, "vtmv(v2)")) return Napi::Number::New(env, 0);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int status = tspice_vtmv(v1, matrix, v2, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vtmv", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
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
  if (!SetExportChecked(env, exports, "vlcom", Napi::Function::New(env, Vlcom), __func__)) return;
  if (!SetExportChecked(env, exports, "vlcom3", Napi::Function::New(env, Vlcom3), __func__)) return;
  if (!SetExportChecked(env, exports, "vperp", Napi::Function::New(env, Vperp), __func__)) return;
  if (!SetExportChecked(env, exports, "vproj", Napi::Function::New(env, Vproj), __func__)) return;
  if (!SetExportChecked(env, exports, "vrel", Napi::Function::New(env, Vrel), __func__)) return;
  if (!SetExportChecked(env, exports, "vrotv", Napi::Function::New(env, Vrotv), __func__)) return;
  if (!SetExportChecked(env, exports, "rotvec", Napi::Function::New(env, Rotvec), __func__)) return;
  if (!SetExportChecked(env, exports, "vtmv", Napi::Function::New(env, Vtmv), __func__)) return;
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
