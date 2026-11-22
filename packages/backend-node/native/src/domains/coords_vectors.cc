#include "coords_vectors.h"

#include <cmath>

#include <cmath>
#include <vector>

#include <cmath>

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

static Napi::Number Pi(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "pi() expects no arguments"));
    return Napi::Number::New(env, 0);
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  return Napi::Number::New(env, tspice_pi());
}

static Napi::Number Twopi(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "twopi() expects no arguments"));
    return Napi::Number::New(env, 0);
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  return Napi::Number::New(env, tspice_twopi());
}

static Napi::Number Halfpi(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "halfpi() expects no arguments"));
    return Napi::Number::New(env, 0);
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  return Napi::Number::New(env, tspice_halfpi());
}

static Napi::Number Dpr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "dpr() expects no arguments"));
    return Napi::Number::New(env, 0);
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  return Napi::Number::New(env, tspice_dpr());
}

static Napi::Number Rpd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "rpd() expects no arguments"));
    return Napi::Number::New(env, 0);
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  return Napi::Number::New(env, tspice_rpd());
}

static Napi::Number Clight(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "clight() expects no arguments"));
    return Napi::Number::New(env, 0);
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  return Napi::Number::New(env, tspice_clight());
}

static Napi::Number Dpmax(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "dpmax() expects no arguments"));
    return Napi::Number::New(env, 0);
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  return Napi::Number::New(env, tspice_dpmax());
}

static Napi::Number Dpmin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "dpmin() expects no arguments"));
    return Napi::Number::New(env, 0);
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  return Napi::Number::New(env, tspice_dpmin());
}

static Napi::Number Intmax(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "intmax() expects no arguments"));
    return Napi::Number::New(env, 0);
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  return Napi::Number::New(env, tspice_intmax());
}

static Napi::Number Intmin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "intmin() expects no arguments"));
    return Napi::Number::New(env, 0);
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  return Napi::Number::New(env, tspice_intmin());
}

static Napi::Object Cyllat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "cyllat() expects three finite numbers"));
    return Napi::Object::New(env);
  }
  const double radius = info[0].As<Napi::Number>().DoubleValue();
  const double lon = info[1].As<Napi::Number>().DoubleValue();
  const double z = info[2].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(radius) || !std::isfinite(lon) || !std::isfinite(z)) {
    ThrowSpiceError(Napi::TypeError::New(env, "cyllat() expects three finite numbers"));
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0, 0.0, 0.0};
  const int status = tspice_cyllat(radius, lon, z, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling cyllat", err);
    return Napi::Object::New(env);
  }
  Napi::Object out = Napi::Object::New(env);
  out.Set("radius", Napi::Number::New(env, values[0]));
  out.Set("lon", Napi::Number::New(env, values[1]));
  out.Set("lat", Napi::Number::New(env, values[2]));
  return out;
}

static Napi::Array Cylrec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "cylrec() expects three finite numbers"));
    return Napi::Array::New(env);
  }
  const double radius = info[0].As<Napi::Number>().DoubleValue();
  const double lon = info[1].As<Napi::Number>().DoubleValue();
  const double z = info[2].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(radius) || !std::isfinite(lon) || !std::isfinite(z)) {
    ThrowSpiceError(Napi::TypeError::New(env, "cylrec() expects three finite numbers"));
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0, 0.0, 0.0};
  const int status = tspice_cylrec(radius, lon, z, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling cylrec", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, values, 3);
}

static Napi::Object Cylsph(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "cylsph() expects three finite numbers"));
    return Napi::Object::New(env);
  }
  const double radius = info[0].As<Napi::Number>().DoubleValue();
  const double lon = info[1].As<Napi::Number>().DoubleValue();
  const double z = info[2].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(radius) || !std::isfinite(lon) || !std::isfinite(z)) {
    ThrowSpiceError(Napi::TypeError::New(env, "cylsph() expects three finite numbers"));
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0, 0.0, 0.0};
  const int status = tspice_cylsph(radius, lon, z, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling cylsph", err);
    return Napi::Object::New(env);
  }
  Napi::Object out = Napi::Object::New(env);
  out.Set("radius", Napi::Number::New(env, values[0]));
  out.Set("colat", Napi::Number::New(env, values[1]));
  out.Set("lon", Napi::Number::New(env, values[2]));
  return out;
}

static Napi::Object Latcyl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "latcyl() expects three finite numbers"));
    return Napi::Object::New(env);
  }
  const double radius = info[0].As<Napi::Number>().DoubleValue();
  const double lon = info[1].As<Napi::Number>().DoubleValue();
  const double lat = info[2].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(radius) || !std::isfinite(lon) || !std::isfinite(lat)) {
    ThrowSpiceError(Napi::TypeError::New(env, "latcyl() expects three finite numbers"));
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0, 0.0, 0.0};
  const int status = tspice_latcyl(radius, lon, lat, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling latcyl", err);
    return Napi::Object::New(env);
  }
  Napi::Object out = Napi::Object::New(env);
  out.Set("radius", Napi::Number::New(env, values[0]));
  out.Set("lon", Napi::Number::New(env, values[1]));
  out.Set("z", Napi::Number::New(env, values[2]));
  return out;
}

static Napi::Object Latsph(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "latsph() expects three finite numbers"));
    return Napi::Object::New(env);
  }
  const double radius = info[0].As<Napi::Number>().DoubleValue();
  const double lon = info[1].As<Napi::Number>().DoubleValue();
  const double lat = info[2].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(radius) || !std::isfinite(lon) || !std::isfinite(lat)) {
    ThrowSpiceError(Napi::TypeError::New(env, "latsph() expects three finite numbers"));
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0, 0.0, 0.0};
  const int status = tspice_latsph(radius, lon, lat, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling latsph", err);
    return Napi::Object::New(env);
  }
  Napi::Object out = Napi::Object::New(env);
  out.Set("radius", Napi::Number::New(env, values[0]));
  out.Set("colat", Napi::Number::New(env, values[1]));
  out.Set("lon", Napi::Number::New(env, values[2]));
  return out;
}

static Napi::Object Reccyl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "reccyl(rect) expects one vector"));
    return Napi::Object::New(env);
  }
  double rect[3] = {0.0, 0.0, 0.0};
  if (!tspice_backend_node::ReadVec3(env, info[0], rect, "reccyl(rect)")) return Napi::Object::New(env);
  if (!std::isfinite(rect[0]) || !std::isfinite(rect[1]) || !std::isfinite(rect[2])) {
    ThrowSpiceError(Napi::TypeError::New(env, "reccyl(rect) must contain three finite numbers"));
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0, 0.0, 0.0};
  const int status = tspice_reccyl(rect, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling reccyl", err);
    return Napi::Object::New(env);
  }
  Napi::Object out = Napi::Object::New(env);
  out.Set("radius", Napi::Number::New(env, values[0]));
  out.Set("lon", Napi::Number::New(env, values[1]));
  out.Set("z", Napi::Number::New(env, values[2]));
  return out;
}

static Napi::Object Sphcyl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sphcyl() expects three finite numbers"));
    return Napi::Object::New(env);
  }
  const double radius = info[0].As<Napi::Number>().DoubleValue();
  const double colat = info[1].As<Napi::Number>().DoubleValue();
  const double lon = info[2].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(radius) || !std::isfinite(colat) || !std::isfinite(lon)) {
    ThrowSpiceError(Napi::TypeError::New(env, "sphcyl() expects three finite numbers"));
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0, 0.0, 0.0};
  const int status = tspice_sphcyl(radius, colat, lon, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sphcyl", err);
    return Napi::Object::New(env);
  }
  Napi::Object out = Napi::Object::New(env);
  out.Set("radius", Napi::Number::New(env, values[0]));
  out.Set("lon", Napi::Number::New(env, values[1]));
  out.Set("z", Napi::Number::New(env, values[2]));
  return out;
}

static Napi::Object Sphlat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sphlat() expects three finite numbers"));
    return Napi::Object::New(env);
  }
  const double radius = info[0].As<Napi::Number>().DoubleValue();
  const double colat = info[1].As<Napi::Number>().DoubleValue();
  const double lon = info[2].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(radius) || !std::isfinite(colat) || !std::isfinite(lon)) {
    ThrowSpiceError(Napi::TypeError::New(env, "sphlat() expects three finite numbers"));
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0, 0.0, 0.0};
  const int status = tspice_sphlat(radius, colat, lon, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sphlat", err);
    return Napi::Object::New(env);
  }
  Napi::Object out = Napi::Object::New(env);
  out.Set("radius", Napi::Number::New(env, values[0]));
  out.Set("lon", Napi::Number::New(env, values[1]));
  out.Set("lat", Napi::Number::New(env, values[2]));
  return out;
}

static bool ReadBasicVector(Napi::Env env, const Napi::Value& value, double out[3], const char* label) {
  if (!tspice_backend_node::ReadVec3(env, value, out, label)) return false;
  if (!std::isfinite(out[0]) || !std::isfinite(out[1]) || !std::isfinite(out[2])) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must contain finite numbers"));
    return false;
  }
  return true;
}

static Napi::Number Vdist(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vdist() expects 2 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  double a[3] = {0.0, 0.0, 0.0};
  if (!ReadBasicVector(env, info[0], a, "vdist(a)")) return Napi::Number::New(env, 0);
  double b[3] = {0.0, 0.0, 0.0};
  if (!ReadBasicVector(env, info[1], b, "vdist(b)")) return Napi::Number::New(env, 0);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int status = tspice_vdist(a, b, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vdist", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Array Vequ(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vequ() expects 1 argument(s)"));
    return Napi::Array::New(env);
  }
  double v[3] = {0.0, 0.0, 0.0};
  if (!ReadBasicVector(env, info[0], v, "vequ(v)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0.0, 0.0, 0.0};
  const int status = tspice_vequ(v, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vequ", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 3);
}

static Napi::Array Vpack(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "vpack() expects 3 argument(s)"));
    return Napi::Array::New(env);
  }
  if (!info[0].IsNumber() || !std::isfinite(info[0].As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, "vpack(x) must be a finite number"));
    return Napi::Array::New(env);
  }
  const double x = info[0].As<Napi::Number>().DoubleValue();
  if (!info[1].IsNumber() || !std::isfinite(info[1].As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, "vpack(y) must be a finite number"));
    return Napi::Array::New(env);
  }
  const double y = info[1].As<Napi::Number>().DoubleValue();
  if (!info[2].IsNumber() || !std::isfinite(info[2].As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, "vpack(z) must be a finite number"));
    return Napi::Array::New(env);
  }
  const double z = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0.0, 0.0, 0.0};
  const int status = tspice_vpack(x, y, z, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vpack", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 3);
}

static Napi::Object Vupack(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vupack() expects 1 argument(s)"));
    return Napi::Object::New(env);
  }
  double v[3] = {0.0, 0.0, 0.0};
  if (!ReadBasicVector(env, info[0], v, "vupack(v)")) return Napi::Object::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0.0, 0.0, 0.0};
  const int status = tspice_vupack(v, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vupack", err);
    return Napi::Object::New(env);
  }
  Napi::Object value = Napi::Object::New(env);
  value.Set("x", Napi::Number::New(env, out[0]));
  value.Set("y", Napi::Number::New(env, out[1]));
  value.Set("z", Napi::Number::New(env, out[2]));
  return value;
}

static Napi::Boolean Vzero(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vzero() expects 1 argument(s)"));
    return Napi::Boolean::New(env, 0);
  }
  double v[3] = {0.0, 0.0, 0.0};
  if (!ReadBasicVector(env, info[0], v, "vzero(v)")) return Napi::Boolean::New(env, 0);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = 0;
  const int status = tspice_vzero(v, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vzero", err);
    return Napi::Boolean::New(env, 0);
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Object Unorm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "unorm() expects 1 argument(s)"));
    return Napi::Object::New(env);
  }
  double v[3] = {0.0, 0.0, 0.0};
  if (!ReadBasicVector(env, info[0], v, "unorm(v)")) return Napi::Object::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0.0, 0.0, 0.0};
  double norm = 0.0;
  const int status = tspice_unorm(v, out, &norm, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling unorm", err);
    return Napi::Object::New(env);
  }
  Napi::Object value = Napi::Object::New(env);
  value.Set("unit", MakeNumberArray(env, out, 3));
  value.Set("norm", Napi::Number::New(env, norm));
  return value;
}

static Napi::Array Ucrss(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "ucrss() expects 2 argument(s)"));
    return Napi::Array::New(env);
  }
  double a[3] = {0.0, 0.0, 0.0};
  if (!ReadBasicVector(env, info[0], a, "ucrss(a)")) return Napi::Array::New(env);
  double b[3] = {0.0, 0.0, 0.0};
  if (!ReadBasicVector(env, info[1], b, "ucrss(b)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0.0, 0.0, 0.0};
  const int status = tspice_ucrss(a, b, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ucrss", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 3);
}

static Napi::Number Vsep(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vsep() expects 2 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  double a[3] = {0.0, 0.0, 0.0};
  if (!ReadBasicVector(env, info[0], a, "vsep(a)")) return Napi::Number::New(env, 0);
  double b[3] = {0.0, 0.0, 0.0};
  if (!ReadBasicVector(env, info[1], b, "vsep(b)")) return Napi::Number::New(env, 0);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int status = tspice_vsep(a, b, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vsep", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

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

static bool ReadConventionScalar(Napi::Env env, const Napi::Value& value, double* out, const char* label) {
  if (!value.IsNumber() || !std::isfinite(value.As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a finite number"));
    return false;
  }
  *out = value.As<Napi::Number>().DoubleValue();
  return true;
}

static bool ReadConventionVector(Napi::Env env, const Napi::Value& value, double* out, const char* label) {
  if (!tspice_backend_node::ReadVec3(env, value, out, label)) return false;
  for (size_t i = 0; i < 3; i++) {
    if (!std::isfinite(out[i])) {
      ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must contain finite numbers"));
      return false;
    }
  }
  return true;
}

static bool ReadConventionBoolean(Napi::Env env, const Napi::Value& value, int* out, const char* label) {
  if (!value.IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a boolean"));
    return false;
  }
  *out = value.As<Napi::Boolean>().Value() ? 1 : 0;
  return true;
}

static bool ReadConventionBody(Napi::Env env, const Napi::Value& value, std::string* out, const char* label) {
  if (!value.IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a string"));
    return false;
  }
  *out = value.As<Napi::String>().Utf8Value();
  if (out->find('\0') != std::string::npos) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must not contain embedded NUL"));
    return false;
  }
  return true;
}

static bool ReadConventionBodyId(Napi::Env env, const Napi::Value& value, int* out) {
  double body = 0.0;
  if (!ReadConventionScalar(env, value, &body, "srfrec(body)")) return false;
  if (std::trunc(body) != body) {
    ThrowSpiceError(Napi::TypeError::New(env, "srfrec(body) must be an integer"));
    return false;
  }
  if (body < -2147483648.0 || body > 2147483647.0) {
    ThrowSpiceError(Napi::RangeError::New(env, "srfrec(body) must be a 32-bit signed integer"));
    return false;
  }
  *out = static_cast<int>(body);
  return true;
}

static Napi::Array Azlrec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "azlrec() expects 5 argument(s)"));
    return Napi::Array::New(env);
  }
  double range = 0.0;
  if (!ReadConventionScalar(env, info[0], &range, "azlrec(range)")) return Napi::Array::New(env);
  double az = 0.0;
  if (!ReadConventionScalar(env, info[1], &az, "azlrec(az)")) return Napi::Array::New(env);
  double el = 0.0;
  if (!ReadConventionScalar(env, info[2], &el, "azlrec(el)")) return Napi::Array::New(env);
  int azccw = 0;
  if (!ReadConventionBoolean(env, info[3], &azccw, "azlrec(azccw)")) return Napi::Array::New(env);
  int elplsz = 0;
  if (!ReadConventionBoolean(env, info[4], &elplsz, "azlrec(elplsz)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0};
  const int status = tspice_azlrec(range, az, el, azccw, elplsz, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling azlrec", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, values, 3);
}

static Napi::Object Recazl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "recazl() expects 3 argument(s)"));
    return Napi::Object::New(env);
  }
  double rect[3] = {0.0};
  if (!ReadConventionVector(env, info[0], rect, "recazl(rect)")) return Napi::Object::New(env);
  int azccw = 0;
  if (!ReadConventionBoolean(env, info[1], &azccw, "recazl(azccw)")) return Napi::Object::New(env);
  int elplsz = 0;
  if (!ReadConventionBoolean(env, info[2], &elplsz, "recazl(elplsz)")) return Napi::Object::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0};
  const int status = tspice_recazl(rect, azccw, elplsz, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling recazl", err);
    return Napi::Object::New(env);
  }
  Napi::Object out = Napi::Object::New(env);
  out.Set("range", Napi::Number::New(env, values[0]));
  out.Set("az", Napi::Number::New(env, values[1]));
  out.Set("el", Napi::Number::New(env, values[2]));
  return out;
}

static Napi::Array Pgrrec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 6) {
    ThrowSpiceError(Napi::TypeError::New(env, "pgrrec() expects 6 argument(s)"));
    return Napi::Array::New(env);
  }
  std::string body;
  if (!ReadConventionBody(env, info[0], &body, "pgrrec(body)")) return Napi::Array::New(env);
  double lon = 0.0;
  if (!ReadConventionScalar(env, info[1], &lon, "pgrrec(lon)")) return Napi::Array::New(env);
  double lat = 0.0;
  if (!ReadConventionScalar(env, info[2], &lat, "pgrrec(lat)")) return Napi::Array::New(env);
  double alt = 0.0;
  if (!ReadConventionScalar(env, info[3], &alt, "pgrrec(alt)")) return Napi::Array::New(env);
  double re = 0.0;
  if (!ReadConventionScalar(env, info[4], &re, "pgrrec(re)")) return Napi::Array::New(env);
  double f = 0.0;
  if (!ReadConventionScalar(env, info[5], &f, "pgrrec(f)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0};
  const int status = tspice_pgrrec(body.c_str(), lon, lat, alt, re, f, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling pgrrec", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, values, 3);
}

static Napi::Object Recpgr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "recpgr() expects 4 argument(s)"));
    return Napi::Object::New(env);
  }
  std::string body;
  if (!ReadConventionBody(env, info[0], &body, "recpgr(body)")) return Napi::Object::New(env);
  double rect[3] = {0.0};
  if (!ReadConventionVector(env, info[1], rect, "recpgr(rect)")) return Napi::Object::New(env);
  double re = 0.0;
  if (!ReadConventionScalar(env, info[2], &re, "recpgr(re)")) return Napi::Object::New(env);
  double f = 0.0;
  if (!ReadConventionScalar(env, info[3], &f, "recpgr(f)")) return Napi::Object::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0};
  const int status = tspice_recpgr(body.c_str(), rect, re, f, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling recpgr", err);
    return Napi::Object::New(env);
  }
  Napi::Object out = Napi::Object::New(env);
  out.Set("lon", Napi::Number::New(env, values[0]));
  out.Set("lat", Napi::Number::New(env, values[1]));
  out.Set("alt", Napi::Number::New(env, values[2]));
  return out;
}

static Napi::Array Radrec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "radrec() expects 3 argument(s)"));
    return Napi::Array::New(env);
  }
  double range = 0.0;
  if (!ReadConventionScalar(env, info[0], &range, "radrec(range)")) return Napi::Array::New(env);
  double ra = 0.0;
  if (!ReadConventionScalar(env, info[1], &ra, "radrec(ra)")) return Napi::Array::New(env);
  double dec = 0.0;
  if (!ReadConventionScalar(env, info[2], &dec, "radrec(dec)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0};
  const int status = tspice_radrec(range, ra, dec, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling radrec", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, values, 3);
}

static Napi::Object Recrad(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "recrad() expects 1 argument(s)"));
    return Napi::Object::New(env);
  }
  double rect[3] = {0.0};
  if (!ReadConventionVector(env, info[0], rect, "recrad(rect)")) return Napi::Object::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0};
  const int status = tspice_recrad(rect, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling recrad", err);
    return Napi::Object::New(env);
  }
  Napi::Object out = Napi::Object::New(env);
  out.Set("range", Napi::Number::New(env, values[0]));
  out.Set("ra", Napi::Number::New(env, values[1]));
  out.Set("dec", Napi::Number::New(env, values[2]));
  return out;
}

static Napi::Array Srfrec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "srfrec() expects 3 argument(s)"));
    return Napi::Array::New(env);
  }
  int body = 0;
  if (!ReadConventionBodyId(env, info[0], &body)) return Napi::Array::New(env);
  double lon = 0.0;
  if (!ReadConventionScalar(env, info[1], &lon, "srfrec(lon)")) return Napi::Array::New(env);
  double lat = 0.0;
  if (!ReadConventionScalar(env, info[2], &lat, "srfrec(lat)")) return Napi::Array::New(env);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double values[3] = {0.0};
  const int status = tspice_srfrec(body, lon, lat, values, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling srfrec", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, values, 3);
}

static bool ReadScalarMathDouble(Napi::Env env, const Napi::Value& value, double* out, const char* label) {
  if (!value.IsNumber() || !std::isfinite(value.As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a finite number"));
    return false;
  }
  *out = value.As<Napi::Number>().DoubleValue();
  return true;
}

static bool ReadScalarMathInt(Napi::Env env, const Napi::Value& value, int* out, const char* label) {
  double number = 0.0;
  if (!ReadScalarMathDouble(env, value, &number, label)) return false;
  if (std::trunc(number) != number) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be an integer"));
    return false;
  }
  if (number < -2147483648.0 || number > 2147483647.0) {
    ThrowSpiceError(Napi::RangeError::New(env, std::string(label) + " must be a 32-bit signed integer"));
    return false;
  }
  *out = static_cast<int>(number);
  return true;
}

static bool ReadScalarMathString(Napi::Env env, const Napi::Value& value, std::string* out, const char* label) {
  if (!value.IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a string"));
    return false;
  }
  *out = value.As<Napi::String>().Utf8Value();
  if (out->find('\0') != std::string::npos) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must not contain embedded NUL"));
    return false;
  }
  return true;
}

static bool CheckScalarMathArrayLength(Napi::Env env, const Napi::Value& value, uint32_t maximum, const char* label) {
  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be an array"));
    return false;
  }
  if (value.As<Napi::Array>().Length() > maximum) {
    ThrowSpiceError(Napi::RangeError::New(env, std::string(label) + " exceeds the supported element count"));
    return false;
  }
  return true;
}

static Napi::Number Brcktd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "brcktd() expects 3 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  double value = 0;
  if (!ReadScalarMathDouble(env, info[0], &value, "brcktd(value)")) return Napi::Number::New(env, 0);
  double end1 = 0;
  if (!ReadScalarMathDouble(env, info[1], &end1, "brcktd(end1)")) return Napi::Number::New(env, 0);
  double end2 = 0;
  if (!ReadScalarMathDouble(env, info[2], &end2, "brcktd(end2)")) return Napi::Number::New(env, 0);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0;
  const int status = tspice_brcktd(value, end1, end2, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling brcktd", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Number Brckti(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "brckti() expects 3 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  int value = 0;
  if (!ReadScalarMathInt(env, info[0], &value, "brckti(value)")) return Napi::Number::New(env, 0);
  int end1 = 0;
  if (!ReadScalarMathInt(env, info[1], &end1, "brckti(end1)")) return Napi::Number::New(env, 0);
  int end2 = 0;
  if (!ReadScalarMathInt(env, info[2], &end2, "brckti(end2)")) return Napi::Number::New(env, 0);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = 0;
  const int status = tspice_brckti(value, end1, end2, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling brckti", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Number Convrt(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "convrt() expects 3 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  double value = 0;
  if (!ReadScalarMathDouble(env, info[0], &value, "convrt(value)")) return Napi::Number::New(env, 0);
  std::string inUnit;
  if (!ReadScalarMathString(env, info[1], &inUnit, "convrt(inUnit)")) return Napi::Number::New(env, 0);
  std::string outUnit;
  if (!ReadScalarMathString(env, info[2], &outUnit, "convrt(outUnit)")) return Napi::Number::New(env, 0);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0;
  const int status = tspice_convrt(value, inUnit.c_str(), outUnit.c_str(), &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling convrt", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Number Sumad(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "sumad() expects 1 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  if (!CheckScalarMathArrayLength(env, info[0], 2147483647U, "sumad(values)")) return Napi::Number::New(env, 0);
  const Napi::Array input = info[0].As<Napi::Array>();
  std::vector<double> values;
  values.reserve(input.Length());
  for (uint32_t i = 0; i < input.Length(); i++) {
    double item = 0;
    if (!ReadScalarMathDouble(env, input.Get(i), &item, "sumad values")) return Napi::Number::New(env, 0);
    values.push_back(item);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0;
  const int status = tspice_sumad(values.data(), static_cast<int>(values.size()), &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sumad", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Number Sumai(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "sumai() expects 1 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  if (!CheckScalarMathArrayLength(env, info[0], 2147483647U, "sumai(values)")) return Napi::Number::New(env, 0);
  const Napi::Array input = info[0].As<Napi::Array>();
  std::vector<int> values;
  values.reserve(input.Length());
  for (uint32_t i = 0; i < input.Length(); i++) {
    int item = 0;
    if (!ReadScalarMathInt(env, input.Get(i), &item, "sumai values")) return Napi::Number::New(env, 0);
    values.push_back(item);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = 0;
  const int status = tspice_sumai(values.data(), static_cast<int>(values.size()), &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sumai", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Number Maxd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "maxd() expects 1 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  if (!CheckScalarMathArrayLength(env, info[0], 30U, "maxd(values)")) return Napi::Number::New(env, 0);
  const Napi::Array input = info[0].As<Napi::Array>();
  std::vector<double> values;
  values.reserve(input.Length());
  for (uint32_t i = 0; i < input.Length(); i++) {
    double item = 0;
    if (!ReadScalarMathDouble(env, input.Get(i), &item, "maxd values")) return Napi::Number::New(env, 0);
    values.push_back(item);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0;
  const int status = tspice_maxd(values.data(), static_cast<int>(values.size()), &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling maxd", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Number Maxi(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "maxi() expects 1 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  if (!CheckScalarMathArrayLength(env, info[0], 30U, "maxi(values)")) return Napi::Number::New(env, 0);
  const Napi::Array input = info[0].As<Napi::Array>();
  std::vector<int> values;
  values.reserve(input.Length());
  for (uint32_t i = 0; i < input.Length(); i++) {
    int item = 0;
    if (!ReadScalarMathInt(env, input.Get(i), &item, "maxi values")) return Napi::Number::New(env, 0);
    values.push_back(item);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = 0;
  const int status = tspice_maxi(values.data(), static_cast<int>(values.size()), &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling maxi", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Number Mind(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "mind() expects 1 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  if (!CheckScalarMathArrayLength(env, info[0], 30U, "mind(values)")) return Napi::Number::New(env, 0);
  const Napi::Array input = info[0].As<Napi::Array>();
  std::vector<double> values;
  values.reserve(input.Length());
  for (uint32_t i = 0; i < input.Length(); i++) {
    double item = 0;
    if (!ReadScalarMathDouble(env, input.Get(i), &item, "mind values")) return Napi::Number::New(env, 0);
    values.push_back(item);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0;
  const int status = tspice_mind(values.data(), static_cast<int>(values.size()), &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mind", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Number Mini(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "mini() expects 1 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  if (!CheckScalarMathArrayLength(env, info[0], 30U, "mini(values)")) return Napi::Number::New(env, 0);
  const Napi::Array input = info[0].As<Napi::Array>();
  std::vector<int> values;
  values.reserve(input.Length());
  for (uint32_t i = 0; i < input.Length(); i++) {
    int item = 0;
    if (!ReadScalarMathInt(env, input.Get(i), &item, "mini values")) return Napi::Number::New(env, 0);
    values.push_back(item);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = 0;
  const int status = tspice_mini(values.data(), static_cast<int>(values.size()), &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mini", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static bool ReadStateDerivativeInput(Napi::Env env, const Napi::Value& value, double* out, const char* label) {
  if (!tspice_backend_node::ReadNumberArrayFixed(env, value, 6, out, label)) return false;
  for (size_t i = 0; i < 6; i++) {
    if (!std::isfinite(out[i])) {
      ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must contain finite numbers"));
      return false;
    }
  }
  return true;
}

static Napi::Array Ducrss(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "ducrss() expects 2 argument(s)"));
    return Napi::Array::New(env);
  }
  double a[6] = {0.0};
  if (!ReadStateDerivativeInput(env, info[0], a, "ducrss(a)")) return Napi::Array::New(env);
  double b[6] = {0.0};
  if (!ReadStateDerivativeInput(env, info[1], b, "ducrss(b)")) return Napi::Array::New(env);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[6] = {0.0};
  const int status = tspice_ducrss(a, b, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ducrss", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 6);
}

static Napi::Array Dvcrss(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "dvcrss() expects 2 argument(s)"));
    return Napi::Array::New(env);
  }
  double a[6] = {0.0};
  if (!ReadStateDerivativeInput(env, info[0], a, "dvcrss(a)")) return Napi::Array::New(env);
  double b[6] = {0.0};
  if (!ReadStateDerivativeInput(env, info[1], b, "dvcrss(b)")) return Napi::Array::New(env);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[6] = {0.0};
  const int status = tspice_dvcrss(a, b, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dvcrss", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 6);
}

static Napi::Number Dvdot(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "dvdot() expects 2 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  double a[6] = {0.0};
  if (!ReadStateDerivativeInput(env, info[0], a, "dvdot(a)")) return Napi::Number::New(env, 0);
  double b[6] = {0.0};
  if (!ReadStateDerivativeInput(env, info[1], b, "dvdot(b)")) return Napi::Number::New(env, 0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int status = tspice_dvdot(a, b, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dvdot", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Array Dvhat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "dvhat() expects 1 argument(s)"));
    return Napi::Array::New(env);
  }
  double state[6] = {0.0};
  if (!ReadStateDerivativeInput(env, info[0], state, "dvhat(state)")) return Napi::Array::New(env);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[6] = {0.0};
  const int status = tspice_dvhat(state, out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dvhat", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out, 6);
}

static Napi::Number Dvnorm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "dvnorm() expects 1 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  double state[6] = {0.0};
  if (!ReadStateDerivativeInput(env, info[0], state, "dvnorm(state)")) return Napi::Number::New(env, 0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int status = tspice_dvnorm(state, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dvnorm", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Number Dvsep(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "dvsep() expects 2 argument(s)"));
    return Napi::Number::New(env, 0);
  }
  double a[6] = {0.0};
  if (!ReadStateDerivativeInput(env, info[0], a, "dvsep(a)")) return Napi::Number::New(env, 0);
  double b[6] = {0.0};
  if (!ReadStateDerivativeInput(env, info[1], b, "dvsep(b)")) return Napi::Number::New(env, 0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int status = tspice_dvsep(a, b, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dvsep", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static bool ReadPolynomialNumber(Napi::Env env, const Napi::Value& value, double* out, const char* label) {
  if (!value.IsNumber() || !std::isfinite(value.As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(label) + " must be a finite number"));
    return false;
  }
  *out = value.As<Napi::Number>().DoubleValue();
  return true;
}

static bool ReadPolynomialOrder(Napi::Env env, const Napi::Value& value, bool chebyshev, int* order, size_t* count) {
  double number = 0.0;
  if (!ReadPolynomialNumber(env, value, &number, "nderiv")) return false;
  const double minimum = chebyshev ? 0.0 : -2147483648.0;
  const double maximum = chebyshev ? 715827881.0 : 2147483646.0;
  if (std::trunc(number) != number || number < minimum || number > maximum) {
    ThrowSpiceError(Napi::RangeError::New(env, "nderiv exceeds the supported derivative order"));
    return false;
  }
  *order = static_cast<int>(number);
  *count = number < 0 ? 0 : static_cast<size_t>(*order) + 1;
  const size_t multiplier = chebyshev ? 3 : 1;
  if (*count > SIZE_MAX / (multiplier * sizeof(double))) {
    ThrowSpiceError(Napi::RangeError::New(env, "Polynomial output/workspace buffer is too large"));
    return false;
  }
  return true;
}

static bool ReadPolynomialCoefficients(Napi::Env env, const Napi::Value& value, bool allowEmpty, std::vector<double>& out, int* count) {
  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Polynomial coefficients must be an array"));
    return false;
  }
  const Napi::Array array = value.As<Napi::Array>();
  const uint32_t length = array.Length();
  if (length > 2147483647U || (!allowEmpty && length == 0) || static_cast<size_t>(length) > SIZE_MAX / sizeof(double)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Unsupported coefficient count"));
    return false;
  }
  *count = static_cast<int>(length);
  // A degree -1 call still receives real storage, never an empty vector's data().
  out.resize(std::max<size_t>(1, length), 0.0);
  for (uint32_t i = 0; i < length; i++) {
    if (!ReadPolynomialNumber(env, array.Get(i), &out[i], "Polynomial coefficient")) return false;
  }
  return true;
}

static bool ReadPolynomialTransform(Napi::Env env, const Napi::Value& value, double out[2]) {
  if (!value.IsArray() || value.As<Napi::Array>().Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "x2s must be a length-2 array"));
    return false;
  }
  const Napi::Array array = value.As<Napi::Array>();
  return ReadPolynomialNumber(env, array.Get(uint32_t{0}), &out[0], "x2s[0]") &&
         ReadPolynomialNumber(env, array.Get(uint32_t{1}), &out[1], "x2s[1]");
}

static Napi::Array Chbder(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "chbder() expects 4 arguments"));
    return Napi::Array::New(env);
  }
  int nderiv = 0;
  size_t outputCount = 0;
  if (!ReadPolynomialOrder(env, info[3], true, &nderiv, &outputCount)) return Napi::Array::New(env);
  std::vector<double> cp;
  int ncoeff = 0;
  if (!ReadPolynomialCoefficients(env, info[0], false, cp, &ncoeff)) return Napi::Array::New(env);
  double x2s[2] = {0};
  if (!ReadPolynomialTransform(env, info[1], x2s)) return Napi::Array::New(env);
  double x = 0.0;
  if (!ReadPolynomialNumber(env, info[2], &x, "chbder(x)")) return Napi::Array::New(env);
  std::vector<double> out(std::max<size_t>(1, outputCount), 0.0);
  std::vector<double> workspace(3 * outputCount, 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_chbder(cp.data(), ncoeff, x2s, x, nderiv, workspace.data(), out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling chbder", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out.data(), outputCount);
}

static Napi::Object Chbigr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "chbigr() expects 3 arguments"));
    return Napi::Object::New(env);
  }
  std::vector<double> cp;
  int ncoeff = 0;
  if (!ReadPolynomialCoefficients(env, info[0], true, cp, &ncoeff)) return Napi::Object::New(env);
  double x2s[2] = {0};
  if (!ReadPolynomialTransform(env, info[1], x2s)) return Napi::Object::New(env);
  double x = 0.0;
  if (!ReadPolynomialNumber(env, info[2], &x, "chbigr(x)")) return Napi::Object::New(env);
  double p = 0.0;
  double secondary = 0.0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_chbigr(cp.data(), ncoeff, x2s, x, &p, &secondary, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling chbigr", err);
    return Napi::Object::New(env);
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("p", Napi::Number::New(env, p));
  result.Set("itgrlp", Napi::Number::New(env, secondary));
  return result;
}

static Napi::Object Chbint(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "chbint() expects 3 arguments"));
    return Napi::Object::New(env);
  }
  std::vector<double> cp;
  int ncoeff = 0;
  if (!ReadPolynomialCoefficients(env, info[0], false, cp, &ncoeff)) return Napi::Object::New(env);
  double x2s[2] = {0};
  if (!ReadPolynomialTransform(env, info[1], x2s)) return Napi::Object::New(env);
  double x = 0.0;
  if (!ReadPolynomialNumber(env, info[2], &x, "chbint(x)")) return Napi::Object::New(env);
  double p = 0.0;
  double secondary = 0.0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_chbint(cp.data(), ncoeff, x2s, x, &p, &secondary, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling chbint", err);
    return Napi::Object::New(env);
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("p", Napi::Number::New(env, p));
  result.Set("dpdx", Napi::Number::New(env, secondary));
  return result;
}

static Napi::Number Chbval(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "chbval() expects 3 arguments"));
    return Napi::Number::New(env, 0);
  }
  std::vector<double> cp;
  int ncoeff = 0;
  if (!ReadPolynomialCoefficients(env, info[0], false, cp, &ncoeff)) return Napi::Number::New(env, 0);
  double x2s[2] = {0};
  if (!ReadPolynomialTransform(env, info[1], x2s)) return Napi::Number::New(env, 0);
  double x = 0.0;
  if (!ReadPolynomialNumber(env, info[2], &x, "chbval(x)")) return Napi::Number::New(env, 0);
  double out = 0.0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_chbval(cp.data(), ncoeff, x2s, x, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling chbval", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, out);
}

static Napi::Array Polyds(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "polyds() expects 3 arguments"));
    return Napi::Array::New(env);
  }
  int nderiv = 0;
  size_t outputCount = 0;
  if (!ReadPolynomialOrder(env, info[1], false, &nderiv, &outputCount)) return Napi::Array::New(env);
  std::vector<double> coeffs;
  int ncoeff = 0;
  if (!ReadPolynomialCoefficients(env, info[0], true, coeffs, &ncoeff)) return Napi::Array::New(env);
  double t = 0.0;
  if (!ReadPolynomialNumber(env, info[2], &t, "polyds(t)")) return Napi::Array::New(env);
  std::vector<double> out(std::max<size_t>(1, outputCount), 0.0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_polyds(coeffs.data(), ncoeff, nderiv, t, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling polyds", err);
    return Napi::Array::New(env);
  }
  return MakeNumberArray(env, out.data(), outputCount);
}

static Napi::Object Rquad(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "rquad() expects 3 arguments"));
    return Napi::Object::New(env);
  }
  double a = 0.0;
  if (!ReadPolynomialNumber(env, info[0], &a, "rquad(a)")) return Napi::Object::New(env);
  double b = 0.0;
  if (!ReadPolynomialNumber(env, info[1], &b, "rquad(b)")) return Napi::Object::New(env);
  double c = 0.0;
  if (!ReadPolynomialNumber(env, info[2], &c, "rquad(c)")) return Napi::Object::New(env);
  double root1[2] = {0};
  double root2[2] = {0};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_rquad(a, b, c, root1, root2, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling rquad", err);
    return Napi::Object::New(env);
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("root1", MakeNumberArray(env, root1, 2));
  result.Set("root2", MakeNumberArray(env, root2, 2));
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
  if (!SetExportChecked(env, exports, "pi", Napi::Function::New(env, Pi), __func__)) return;
  if (!SetExportChecked(env, exports, "twopi", Napi::Function::New(env, Twopi), __func__)) return;
  if (!SetExportChecked(env, exports, "halfpi", Napi::Function::New(env, Halfpi), __func__)) return;
  if (!SetExportChecked(env, exports, "dpr", Napi::Function::New(env, Dpr), __func__)) return;
  if (!SetExportChecked(env, exports, "rpd", Napi::Function::New(env, Rpd), __func__)) return;
  if (!SetExportChecked(env, exports, "clight", Napi::Function::New(env, Clight), __func__)) return;
  if (!SetExportChecked(env, exports, "dpmax", Napi::Function::New(env, Dpmax), __func__)) return;
  if (!SetExportChecked(env, exports, "dpmin", Napi::Function::New(env, Dpmin), __func__)) return;
  if (!SetExportChecked(env, exports, "intmax", Napi::Function::New(env, Intmax), __func__)) return;
  if (!SetExportChecked(env, exports, "intmin", Napi::Function::New(env, Intmin), __func__)) return;
  if (!SetExportChecked(env, exports, "cyllat", Napi::Function::New(env, Cyllat), __func__)) return;
  if (!SetExportChecked(env, exports, "cylrec", Napi::Function::New(env, Cylrec), __func__)) return;
  if (!SetExportChecked(env, exports, "cylsph", Napi::Function::New(env, Cylsph), __func__)) return;
  if (!SetExportChecked(env, exports, "latcyl", Napi::Function::New(env, Latcyl), __func__)) return;
  if (!SetExportChecked(env, exports, "latsph", Napi::Function::New(env, Latsph), __func__)) return;
  if (!SetExportChecked(env, exports, "reccyl", Napi::Function::New(env, Reccyl), __func__)) return;
  if (!SetExportChecked(env, exports, "sphcyl", Napi::Function::New(env, Sphcyl), __func__)) return;
  if (!SetExportChecked(env, exports, "sphlat", Napi::Function::New(env, Sphlat), __func__)) return;
  if (!SetExportChecked(env, exports, "vdist", Napi::Function::New(env, Vdist), __func__)) return;
  if (!SetExportChecked(env, exports, "vequ", Napi::Function::New(env, Vequ), __func__)) return;
  if (!SetExportChecked(env, exports, "vpack", Napi::Function::New(env, Vpack), __func__)) return;
  if (!SetExportChecked(env, exports, "vupack", Napi::Function::New(env, Vupack), __func__)) return;
  if (!SetExportChecked(env, exports, "vzero", Napi::Function::New(env, Vzero), __func__)) return;
  if (!SetExportChecked(env, exports, "unorm", Napi::Function::New(env, Unorm), __func__)) return;
  if (!SetExportChecked(env, exports, "ucrss", Napi::Function::New(env, Ucrss), __func__)) return;
  if (!SetExportChecked(env, exports, "vsep", Napi::Function::New(env, Vsep), __func__)) return;
  if (!SetExportChecked(env, exports, "vlcom", Napi::Function::New(env, Vlcom), __func__)) return;
  if (!SetExportChecked(env, exports, "vlcom3", Napi::Function::New(env, Vlcom3), __func__)) return;
  if (!SetExportChecked(env, exports, "vperp", Napi::Function::New(env, Vperp), __func__)) return;
  if (!SetExportChecked(env, exports, "vproj", Napi::Function::New(env, Vproj), __func__)) return;
  if (!SetExportChecked(env, exports, "vrel", Napi::Function::New(env, Vrel), __func__)) return;
  if (!SetExportChecked(env, exports, "vrotv", Napi::Function::New(env, Vrotv), __func__)) return;
  if (!SetExportChecked(env, exports, "rotvec", Napi::Function::New(env, Rotvec), __func__)) return;
  if (!SetExportChecked(env, exports, "vtmv", Napi::Function::New(env, Vtmv), __func__)) return;
  if (!SetExportChecked(env, exports, "azlrec", Napi::Function::New(env, Azlrec), __func__)) return;
  if (!SetExportChecked(env, exports, "recazl", Napi::Function::New(env, Recazl), __func__)) return;
  if (!SetExportChecked(env, exports, "pgrrec", Napi::Function::New(env, Pgrrec), __func__)) return;
  if (!SetExportChecked(env, exports, "recpgr", Napi::Function::New(env, Recpgr), __func__)) return;
  if (!SetExportChecked(env, exports, "radrec", Napi::Function::New(env, Radrec), __func__)) return;
  if (!SetExportChecked(env, exports, "recrad", Napi::Function::New(env, Recrad), __func__)) return;
  if (!SetExportChecked(env, exports, "srfrec", Napi::Function::New(env, Srfrec), __func__)) return;
  if (!SetExportChecked(env, exports, "brcktd", Napi::Function::New(env, Brcktd), __func__)) return;
  if (!SetExportChecked(env, exports, "brckti", Napi::Function::New(env, Brckti), __func__)) return;
  if (!SetExportChecked(env, exports, "convrt", Napi::Function::New(env, Convrt), __func__)) return;
  if (!SetExportChecked(env, exports, "sumad", Napi::Function::New(env, Sumad), __func__)) return;
  if (!SetExportChecked(env, exports, "sumai", Napi::Function::New(env, Sumai), __func__)) return;
  if (!SetExportChecked(env, exports, "maxd", Napi::Function::New(env, Maxd), __func__)) return;
  if (!SetExportChecked(env, exports, "maxi", Napi::Function::New(env, Maxi), __func__)) return;
  if (!SetExportChecked(env, exports, "mind", Napi::Function::New(env, Mind), __func__)) return;
  if (!SetExportChecked(env, exports, "mini", Napi::Function::New(env, Mini), __func__)) return;
  if (!SetExportChecked(env, exports, "ducrss", Napi::Function::New(env, Ducrss), __func__)) return;
  if (!SetExportChecked(env, exports, "dvcrss", Napi::Function::New(env, Dvcrss), __func__)) return;
  if (!SetExportChecked(env, exports, "dvdot", Napi::Function::New(env, Dvdot), __func__)) return;
  if (!SetExportChecked(env, exports, "dvhat", Napi::Function::New(env, Dvhat), __func__)) return;
  if (!SetExportChecked(env, exports, "dvnorm", Napi::Function::New(env, Dvnorm), __func__)) return;
  if (!SetExportChecked(env, exports, "dvsep", Napi::Function::New(env, Dvsep), __func__)) return;
  if (!SetExportChecked(env, exports, "chbder", Napi::Function::New(env, Chbder), __func__)) return;
  if (!SetExportChecked(env, exports, "chbigr", Napi::Function::New(env, Chbigr), __func__)) return;
  if (!SetExportChecked(env, exports, "chbint", Napi::Function::New(env, Chbint), __func__)) return;
  if (!SetExportChecked(env, exports, "chbval", Napi::Function::New(env, Chbval), __func__)) return;
  if (!SetExportChecked(env, exports, "polyds", Napi::Function::New(env, Polyds), __func__)) return;
  if (!SetExportChecked(env, exports, "rquad", Napi::Function::New(env, Rquad), __func__)) return;
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
