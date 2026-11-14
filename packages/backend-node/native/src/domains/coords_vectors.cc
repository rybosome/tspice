#include "coords_vectors.h"

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

static Napi::Value Eul2m(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length() != 6) { ThrowSpiceError(Napi::TypeError::New(env,"eul2m: incorrect argument count")); return env.Undefined(); }
  if (!info[0].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"eul2m(angle3) must be numeric")); return env.Undefined(); }
  const double angle3 = info[0].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(angle3)) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid eul2m(angle3)")); return env.Undefined(); }
  if (!info[1].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"eul2m(angle2) must be numeric")); return env.Undefined(); }
  const double angle2 = info[1].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(angle2)) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid eul2m(angle2)")); return env.Undefined(); }
  if (!info[2].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"eul2m(angle1) must be numeric")); return env.Undefined(); }
  const double angle1 = info[2].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(angle1)) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid eul2m(angle1)")); return env.Undefined(); }
  if (!info[3].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"eul2m(axis3) must be numeric")); return env.Undefined(); }
  const double axis3 = info[3].As<Napi::Number>().DoubleValue();
  if (!(axis3 >= INT32_MIN && axis3 <= INT32_MAX && std::trunc(axis3) == axis3)) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid eul2m(axis3)")); return env.Undefined(); }
  if (!info[4].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"eul2m(axis2) must be numeric")); return env.Undefined(); }
  const double axis2 = info[4].As<Napi::Number>().DoubleValue();
  if (!(axis2 >= INT32_MIN && axis2 <= INT32_MAX && std::trunc(axis2) == axis2)) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid eul2m(axis2)")); return env.Undefined(); }
  if (!info[5].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"eul2m(axis1) must be numeric")); return env.Undefined(); }
  const double axis1 = info[5].As<Napi::Number>().DoubleValue();
  if (!(axis1 >= INT32_MIN && axis1 <= INT32_MAX && std::trunc(axis1) == axis1)) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid eul2m(axis1)")); return env.Undefined(); }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double r[9] = {};
  if (tspice_eul2m(angle3, angle2, angle1, static_cast<int>(axis3), static_cast<int>(axis2), static_cast<int>(axis1), r, err, sizeof(err))) { ThrowSpiceError(env,"eul2m",err); return env.Undefined(); }
  return MakeNumberArray(env,r,9);
}

static Napi::Value M2eul(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length() != 4) { ThrowSpiceError(Napi::TypeError::New(env,"m2eul: incorrect argument count")); return env.Undefined(); }
  double m[9];
  if (!ReadFixedMatrix(env, info[0], 9, m, "m2eul(m)")) return env.Undefined();
  if (!info[1].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"m2eul(axis3) must be numeric")); return env.Undefined(); }
  const double axis3 = info[1].As<Napi::Number>().DoubleValue();
  if (!(axis3 >= INT32_MIN && axis3 <= INT32_MAX && std::trunc(axis3) == axis3)) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid m2eul(axis3)")); return env.Undefined(); }
  if (!info[2].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"m2eul(axis2) must be numeric")); return env.Undefined(); }
  const double axis2 = info[2].As<Napi::Number>().DoubleValue();
  if (!(axis2 >= INT32_MIN && axis2 <= INT32_MAX && std::trunc(axis2) == axis2)) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid m2eul(axis2)")); return env.Undefined(); }
  if (!info[3].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"m2eul(axis1) must be numeric")); return env.Undefined(); }
  const double axis1 = info[3].As<Napi::Number>().DoubleValue();
  if (!(axis1 >= INT32_MIN && axis1 <= INT32_MAX && std::trunc(axis1) == axis1)) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid m2eul(axis1)")); return env.Undefined(); }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double angle3[1] = {};
  double angle2[1] = {};
  double angle1[1] = {};
  if (tspice_m2eul(m, static_cast<int>(axis3), static_cast<int>(axis2), static_cast<int>(axis1), angle3, angle2, angle1, err, sizeof(err))) { ThrowSpiceError(env,"m2eul",err); return env.Undefined(); }
  auto result=Napi::Object::New(env);
  result.Set("angle3",Napi::Number::New(env,angle3[0]));
  result.Set("angle2",Napi::Number::New(env,angle2[0]));
  result.Set("angle1",Napi::Number::New(env,angle1[0]));
  return result;
}

static Napi::Value M2q(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length() != 1) { ThrowSpiceError(Napi::TypeError::New(env,"m2q: incorrect argument count")); return env.Undefined(); }
  double m[9];
  if (!ReadFixedMatrix(env, info[0], 9, m, "m2q(m)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double q[4] = {};
  if (tspice_m2q(m, q, err, sizeof(err))) { ThrowSpiceError(env,"m2q",err); return env.Undefined(); }
  return MakeNumberArray(env,q,4);
}

static Napi::Value Q2m(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length() != 1) { ThrowSpiceError(Napi::TypeError::New(env,"q2m: incorrect argument count")); return env.Undefined(); }
  double q[4];
  if (!ReadFixedMatrix(env, info[0], 4, q, "q2m(q)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double r[9] = {};
  if (tspice_q2m(q, r, err, sizeof(err))) { ThrowSpiceError(env,"q2m",err); return env.Undefined(); }
  return MakeNumberArray(env,r,9);
}

static Napi::Value Qxq(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length() != 2) { ThrowSpiceError(Napi::TypeError::New(env,"qxq: incorrect argument count")); return env.Undefined(); }
  double q1[4];
  if (!ReadFixedMatrix(env, info[0], 4, q1, "qxq(q1)")) return env.Undefined();
  double q2[4];
  if (!ReadFixedMatrix(env, info[1], 4, q2, "qxq(q2)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double qout[4] = {};
  if (tspice_qxq(q1, q2, qout, err, sizeof(err))) { ThrowSpiceError(env,"qxq",err); return env.Undefined(); }
  return MakeNumberArray(env,qout,4);
}

static Napi::Value Qdq2av(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length() != 2) { ThrowSpiceError(Napi::TypeError::New(env,"qdq2av: incorrect argument count")); return env.Undefined(); }
  double q[4];
  if (!ReadFixedMatrix(env, info[0], 4, q, "qdq2av(q)")) return env.Undefined();
  double dq[4];
  if (!ReadFixedMatrix(env, info[1], 4, dq, "qdq2av(dq)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double av[3] = {};
  if (tspice_qdq2av(q, dq, av, err, sizeof(err))) { ThrowSpiceError(env,"qdq2av",err); return env.Undefined(); }
  return MakeNumberArray(env,av,3);
}

static Napi::Value Raxisa(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length() != 1) { ThrowSpiceError(Napi::TypeError::New(env,"raxisa: incorrect argument count")); return env.Undefined(); }
  double m[9];
  if (!ReadFixedMatrix(env, info[0], 9, m, "raxisa(m)")) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double axis[3] = {};
  double angle[1] = {};
  if (tspice_raxisa(m, axis, angle, err, sizeof(err))) { ThrowSpiceError(env,"raxisa",err); return env.Undefined(); }
  auto result=Napi::Object::New(env);
  result.Set("axis",MakeNumberArray(env,axis,3));
  result.Set("angle",Napi::Number::New(env,angle[0]));
  return result;
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
  if (!SetExportChecked(env, exports, "eul2m", Napi::Function::New(env,Eul2m), __func__)) return;
  if (!SetExportChecked(env, exports, "m2eul", Napi::Function::New(env,M2eul), __func__)) return;
  if (!SetExportChecked(env, exports, "m2q", Napi::Function::New(env,M2q), __func__)) return;
  if (!SetExportChecked(env, exports, "q2m", Napi::Function::New(env,Q2m), __func__)) return;
  if (!SetExportChecked(env, exports, "qxq", Napi::Function::New(env,Qxq), __func__)) return;
  if (!SetExportChecked(env, exports, "qdq2av", Napi::Function::New(env,Qdq2av), __func__)) return;
  if (!SetExportChecked(env, exports, "raxisa", Napi::Function::New(env,Raxisa), __func__)) return;
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
