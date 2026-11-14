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

static bool ReadGeneralVectorScalar(Napi::Env env, const Napi::Value& value, double* out, const char* label) {
  if (!value.IsNumber() || !std::isfinite(value.As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a finite number"));
    return false;
  }
  *out = value.As<Napi::Number>().DoubleValue();
  return true;
}

static bool ReadGeneralVector(Napi::Env env, const Napi::Value& value, std::vector<double>& out, int* dimension, uint32_t maximum, const char* label) {
  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be an array"));
    return false;
  }
  const Napi::Array array = value.As<Napi::Array>();
  const uint32_t count = array.Length();
  if (count > maximum || static_cast<size_t>(count) > SIZE_MAX / sizeof(double)) {
    ThrowSpiceError(Napi::RangeError::New(env, std::string(label) + " exceeds the supported dimension"));
    return false;
  }
  *dimension = static_cast<int>(count);
  // Even dimension-zero calls receive valid storage, never vector::data() on
  // an empty vector. The dummy value is not part of the public input/output.
  out.resize(std::max<size_t>(1, count), 0.0);
  for (uint32_t i = 0; i < count; i++) {
    if (!ReadGeneralVectorScalar(env, array.Get(i), &out[i], label)) return false;
  }
  return true;
}

static Napi::Array Vaddg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vaddg() expects 2 argument(s)"));
    return Napi::Array::New(env);
  }
  std::vector<double> a;
  int aDimension = 0;
  if (!ReadGeneralVector(env, info[0], a, &aDimension, 2147483647U, "vaddg(a)")) return Napi::Array::New(env);
  std::vector<double> b;
  int bDimension = 0;
  if (!ReadGeneralVector(env, info[1], b, &bDimension, 2147483647U, "vaddg(b)")) return Napi::Array::New(env);
  if (aDimension != bDimension) {
    ThrowSpiceError(Napi::RangeError::New(env, "vaddg() vectors must have equal lengths"));
    return Napi::Array::New(env);
  }
  std::vector<double> out(std::max<size_t>(1, static_cast<size_t>(aDimension)), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vaddg(a.data(), b.data(), aDimension, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vaddg", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out.data(), static_cast<size_t>(aDimension));
}

static Napi::Number Vdistg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vdistg() expects 2 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  std::vector<double> a;
  int aDimension = 0;
  if (!ReadGeneralVector(env, info[0], a, &aDimension, 2147483647U, "vdistg(a)")) return Napi::Number::New(env, 0);
  std::vector<double> b;
  int bDimension = 0;
  if (!ReadGeneralVector(env, info[1], b, &bDimension, 2147483647U, "vdistg(b)")) return Napi::Number::New(env, 0);
  if (aDimension != bDimension) {
    ThrowSpiceError(Napi::RangeError::New(env, "vdistg() vectors must have equal lengths"));
    return Napi::Number::New(env, 0);
  }
  double out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vdistg(a.data(), b.data(), aDimension, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vdistg", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Number Vdotg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vdotg() expects 2 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  std::vector<double> a;
  int aDimension = 0;
  if (!ReadGeneralVector(env, info[0], a, &aDimension, 2147483647U, "vdotg(a)")) return Napi::Number::New(env, 0);
  std::vector<double> b;
  int bDimension = 0;
  if (!ReadGeneralVector(env, info[1], b, &bDimension, 2147483647U, "vdotg(b)")) return Napi::Number::New(env, 0);
  if (aDimension != bDimension) {
    ThrowSpiceError(Napi::RangeError::New(env, "vdotg() vectors must have equal lengths"));
    return Napi::Number::New(env, 0);
  }
  double out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vdotg(a.data(), b.data(), aDimension, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vdotg", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Array Vequg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vequg() expects 1 argument(s)"));
    return Napi::Array::New(env);
  }
  std::vector<double> v;
  int vDimension = 0;
  if (!ReadGeneralVector(env, info[0], v, &vDimension, 2147483647U, "vequg(v)")) return Napi::Array::New(env);
  std::vector<double> out(std::max<size_t>(1, static_cast<size_t>(vDimension)), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vequg(v.data(), vDimension, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vequg", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out.data(), static_cast<size_t>(vDimension));
}

static Napi::Array Vhatg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vhatg() expects 1 argument(s)"));
    return Napi::Array::New(env);
  }
  std::vector<double> v;
  int vDimension = 0;
  if (!ReadGeneralVector(env, info[0], v, &vDimension, 2147483647U, "vhatg(v)")) return Napi::Array::New(env);
  std::vector<double> out(std::max<size_t>(1, static_cast<size_t>(vDimension)), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vhatg(v.data(), vDimension, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vhatg", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out.data(), static_cast<size_t>(vDimension));
}

static Napi::Array Vlcomg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "vlcomg() expects 4 argument(s)"));
    return Napi::Array::New(env);
  }
  double a = 0.0;
  if (!ReadGeneralVectorScalar(env, info[0], &a, "vlcomg(a)")) return Napi::Array::New(env);
  std::vector<double> v1;
  int v1Dimension = 0;
  if (!ReadGeneralVector(env, info[1], v1, &v1Dimension, 2147483647U, "vlcomg(v1)")) return Napi::Array::New(env);
  double b = 0.0;
  if (!ReadGeneralVectorScalar(env, info[2], &b, "vlcomg(b)")) return Napi::Array::New(env);
  std::vector<double> v2;
  int v2Dimension = 0;
  if (!ReadGeneralVector(env, info[3], v2, &v2Dimension, 2147483647U, "vlcomg(v2)")) return Napi::Array::New(env);
  if (v1Dimension != v2Dimension) {
    ThrowSpiceError(Napi::RangeError::New(env, "vlcomg() vectors must have equal lengths"));
    return Napi::Array::New(env);
  }
  std::vector<double> out(std::max<size_t>(1, static_cast<size_t>(v1Dimension)), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vlcomg(a, v1.data(), b, v2.data(), v1Dimension, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vlcomg", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out.data(), static_cast<size_t>(v1Dimension));
}

static Napi::Array Vminug(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vminug() expects 1 argument(s)"));
    return Napi::Array::New(env);
  }
  std::vector<double> v;
  int vDimension = 0;
  if (!ReadGeneralVector(env, info[0], v, &vDimension, 2147483647U, "vminug(v)")) return Napi::Array::New(env);
  std::vector<double> out(std::max<size_t>(1, static_cast<size_t>(vDimension)), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vminug(v.data(), vDimension, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vminug", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out.data(), static_cast<size_t>(vDimension));
}

static Napi::Number Vnormg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vnormg() expects 1 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  std::vector<double> v;
  int vDimension = 0;
  if (!ReadGeneralVector(env, info[0], v, &vDimension, 2147483647U, "vnormg(v)")) return Napi::Number::New(env, 0);
  double out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vnormg(v.data(), vDimension, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vnormg", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Array Vprojg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vprojg() expects 2 argument(s)"));
    return Napi::Array::New(env);
  }
  std::vector<double> a;
  int aDimension = 0;
  if (!ReadGeneralVector(env, info[0], a, &aDimension, 2147483646U, "vprojg(a)")) return Napi::Array::New(env);
  std::vector<double> b;
  int bDimension = 0;
  if (!ReadGeneralVector(env, info[1], b, &bDimension, 2147483646U, "vprojg(b)")) return Napi::Array::New(env);
  if (aDimension != bDimension) {
    ThrowSpiceError(Napi::RangeError::New(env, "vprojg() vectors must have equal lengths"));
    return Napi::Array::New(env);
  }
  std::vector<double> out(std::max<size_t>(1, static_cast<size_t>(aDimension)), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vprojg(a.data(), b.data(), aDimension, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vprojg", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out.data(), static_cast<size_t>(aDimension));
}

static Napi::Number Vrelg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vrelg() expects 2 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  std::vector<double> a;
  int aDimension = 0;
  if (!ReadGeneralVector(env, info[0], a, &aDimension, 2147483647U, "vrelg(a)")) return Napi::Number::New(env, 0);
  std::vector<double> b;
  int bDimension = 0;
  if (!ReadGeneralVector(env, info[1], b, &bDimension, 2147483647U, "vrelg(b)")) return Napi::Number::New(env, 0);
  if (aDimension != bDimension) {
    ThrowSpiceError(Napi::RangeError::New(env, "vrelg() vectors must have equal lengths"));
    return Napi::Number::New(env, 0);
  }
  double out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vrelg(a.data(), b.data(), aDimension, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vrelg", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Array Vsclg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vsclg() expects 2 argument(s)"));
    return Napi::Array::New(env);
  }
  double s = 0.0;
  if (!ReadGeneralVectorScalar(env, info[0], &s, "vsclg(s)")) return Napi::Array::New(env);
  std::vector<double> v;
  int vDimension = 0;
  if (!ReadGeneralVector(env, info[1], v, &vDimension, 2147483647U, "vsclg(v)")) return Napi::Array::New(env);
  std::vector<double> out(std::max<size_t>(1, static_cast<size_t>(vDimension)), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vsclg(s, v.data(), vDimension, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vsclg", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out.data(), static_cast<size_t>(vDimension));
}

static Napi::Number Vsepg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vsepg() expects 2 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  std::vector<double> a;
  int aDimension = 0;
  if (!ReadGeneralVector(env, info[0], a, &aDimension, 2147483647U, "vsepg(a)")) return Napi::Number::New(env, 0);
  std::vector<double> b;
  int bDimension = 0;
  if (!ReadGeneralVector(env, info[1], b, &bDimension, 2147483647U, "vsepg(b)")) return Napi::Number::New(env, 0);
  if (aDimension != bDimension) {
    ThrowSpiceError(Napi::RangeError::New(env, "vsepg() vectors must have equal lengths"));
    return Napi::Number::New(env, 0);
  }
  double out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vsepg(a.data(), b.data(), aDimension, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vsepg", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Array Vsubg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vsubg() expects 2 argument(s)"));
    return Napi::Array::New(env);
  }
  std::vector<double> a;
  int aDimension = 0;
  if (!ReadGeneralVector(env, info[0], a, &aDimension, 2147483647U, "vsubg(a)")) return Napi::Array::New(env);
  std::vector<double> b;
  int bDimension = 0;
  if (!ReadGeneralVector(env, info[1], b, &bDimension, 2147483647U, "vsubg(b)")) return Napi::Array::New(env);
  if (aDimension != bDimension) {
    ThrowSpiceError(Napi::RangeError::New(env, "vsubg() vectors must have equal lengths"));
    return Napi::Array::New(env);
  }
  std::vector<double> out(std::max<size_t>(1, static_cast<size_t>(aDimension)), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vsubg(a.data(), b.data(), aDimension, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vsubg", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out.data(), static_cast<size_t>(aDimension));
}

static Napi::Boolean Vzerog(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vzerog() expects 1 argument(s)"));
    return Napi::Boolean::New(env, false);
  }
  std::vector<double> v;
  int vDimension = 0;
  if (!ReadGeneralVector(env, info[0], v, &vDimension, 2147483647U, "vzerog(v)")) return Napi::Boolean::New(env, false);
  int out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_vzerog(v.data(), vDimension, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vzerog", err);
    return Napi::Boolean::New(env, false);
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Object Unormg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "unormg() expects 1 argument(s)"));
    return Napi::Object::New(env);
  }
  std::vector<double> v;
  int vDimension = 0;
  if (!ReadGeneralVector(env, info[0], v, &vDimension, 2147483646U, "unormg(v)")) return Napi::Object::New(env);
  std::vector<double> out(std::max<size_t>(1, static_cast<size_t>(vDimension)), 0.0);
  double norm = 0.0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_unormg(v.data(), vDimension, out.data(), &norm, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling unormg", err);
    return Napi::Object::New(env);
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("unit", MakeNumberArray(env, out.data(), static_cast<size_t>(vDimension)));
  result.Set("norm", Napi::Number::New(env, norm));
  return result;
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
  if (!SetExportChecked(env, exports, "vaddg", Napi::Function::New(env, Vaddg), __func__)) return;
  if (!SetExportChecked(env, exports, "vdistg", Napi::Function::New(env, Vdistg), __func__)) return;
  if (!SetExportChecked(env, exports, "vdotg", Napi::Function::New(env, Vdotg), __func__)) return;
  if (!SetExportChecked(env, exports, "vequg", Napi::Function::New(env, Vequg), __func__)) return;
  if (!SetExportChecked(env, exports, "vhatg", Napi::Function::New(env, Vhatg), __func__)) return;
  if (!SetExportChecked(env, exports, "vlcomg", Napi::Function::New(env, Vlcomg), __func__)) return;
  if (!SetExportChecked(env, exports, "vminug", Napi::Function::New(env, Vminug), __func__)) return;
  if (!SetExportChecked(env, exports, "vnormg", Napi::Function::New(env, Vnormg), __func__)) return;
  if (!SetExportChecked(env, exports, "vprojg", Napi::Function::New(env, Vprojg), __func__)) return;
  if (!SetExportChecked(env, exports, "vrelg", Napi::Function::New(env, Vrelg), __func__)) return;
  if (!SetExportChecked(env, exports, "vsclg", Napi::Function::New(env, Vsclg), __func__)) return;
  if (!SetExportChecked(env, exports, "vsepg", Napi::Function::New(env, Vsepg), __func__)) return;
  if (!SetExportChecked(env, exports, "vsubg", Napi::Function::New(env, Vsubg), __func__)) return;
  if (!SetExportChecked(env, exports, "vzerog", Napi::Function::New(env, Vzerog), __func__)) return;
  if (!SetExportChecked(env, exports, "unormg", Napi::Function::New(env, Unormg), __func__)) return;
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
