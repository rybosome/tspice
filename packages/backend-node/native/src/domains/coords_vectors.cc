#include "coords_vectors.h"

#include <climits>
#include <cmath>

#include <cmath>
#include <vector>

#include <cmath>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

#include <cmath>
#include <cstdint>
#include <memory>
#include <new>

#include <cmath>

#include "tspice_matrix_shapes.h"
#include <memory>
#include <new>
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

static bool ReadStorageNumber(Napi::Env env, const Napi::Value& value, double* out) {
  if (!value.IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a double storage value"));
    return false;
  }
  *out = value.As<Napi::Number>().DoubleValue();
  return true;
}

static bool ReadStorageNumber(Napi::Env env, const Napi::Value& value, int* out) {
  if (value.IsNumber()) {
    const double number = value.As<Napi::Number>().DoubleValue();
    if (std::isfinite(number) && std::trunc(number) == number &&
        number >= INT32_MIN && number <= INT32_MAX) {
      *out = static_cast<int>(number);
      return true;
    }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a signed 32-bit integer"));
  return false;
}

static bool ReadStorageNumber(Napi::Env env, const Napi::Value& value, unsigned char* out) {
  if (value.IsNumber()) {
    const double number = value.As<Napi::Number>().DoubleValue();
    if (number >= 0 && number <= 255 && std::trunc(number) == number) {
      *out = static_cast<unsigned char>(number);
      return true;
    }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a byte from 0 to 255"));
  return false;
}

static bool ReadStorageLength(Napi::Env env, const Napi::Value& value, size_t elementSize, int* out) {
  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a storage array"));
    return false;
  }
  const uint32_t length = value.As<Napi::Array>().Length();
  if (length > INT32_MAX || static_cast<size_t>(length) > SIZE_MAX / elementSize) {
    ThrowSpiceError(Napi::RangeError::New(env, "Storage array is too large"));
    return false;
  }
  *out = static_cast<int>(length);
  return true;
}

template<typename T>
static std::unique_ptr<T[]> CopyStorageArray(Napi::Env env, const Napi::Array& array, int length) {
  // Use the checked length even if an element getter changes an input array.
  std::unique_ptr<T[]> copy(new (std::nothrow) T[length > 0 ? length : 1]);
  if (!copy) {
    ThrowSpiceError(Napi::Error::New(env, "Storage allocation failed"));
    return nullptr;
  }
  if (length == 0) copy[0] = 0;
  for (int i = 0; i < length; i++) {
    const Napi::Value item = array.Get(static_cast<uint32_t>(i));
    if (env.IsExceptionPending() || !ReadStorageNumber(env, item, &copy[i])) return nullptr;
  }
  return copy;
}

template<typename T>
static Napi::Array StorageResult(Napi::Env env, const T* values, int length) {
  const Napi::Array out = Napi::Array::New(env, static_cast<size_t>(length));
  for (int i = 0; i < length; i++) {
    out.Set(static_cast<uint32_t>(i), Napi::Number::New(env, values[i]));
  }
  return out;
}

static Napi::Array Clearc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "clearc() expects 3 arguments"));
    return Napi::Array::New(env);
  }
  int ndim = 0;
  if (!ReadStorageNumber(env, info[0], &ndim)) return Napi::Array::New(env);
  int arrlen = 0;
  if (!ReadStorageNumber(env, info[1], &arrlen)) return Napi::Array::New(env);
  int bytesLength = 0;
  if (!ReadStorageLength(env, info[2], sizeof(unsigned char), &bytesLength)) return Napi::Array::New(env);
  if (ndim > 0 && arrlen >= 2 && ndim > bytesLength / arrlen) {
    ThrowSpiceError(Napi::RangeError::New(env, "clearc() count does not fit the supplied storage"));
    return Napi::Array::New(env);
  }
  auto bytes = CopyStorageArray<unsigned char>(env, info[2].As<Napi::Array>(), bytesLength);
  if (!bytes) return Napi::Array::New(env);
  {
    std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
    char err[tspice_backend_node::kErrMaxBytes];
    const int status = tspice_clearc(ndim, arrlen, bytes.get(), bytesLength, err, static_cast<int>(sizeof(err)));
    if (status != 0) {
      ThrowSpiceError(env, "CSPICE failed while calling clearc", err);
      return Napi::Array::New(env);
    }
  }
  return StorageResult(env, bytes.get(), bytesLength);
}

static Napi::Array Cleard(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "cleard() expects 2 arguments"));
    return Napi::Array::New(env);
  }
  int ndim = 0;
  if (!ReadStorageNumber(env, info[0], &ndim)) return Napi::Array::New(env);
  int valuesLength = 0;
  if (!ReadStorageLength(env, info[1], sizeof(double), &valuesLength)) return Napi::Array::New(env);
  if (ndim > valuesLength) {
    ThrowSpiceError(Napi::RangeError::New(env, "cleard() count does not fit the supplied storage"));
    return Napi::Array::New(env);
  }
  auto values = CopyStorageArray<double>(env, info[1].As<Napi::Array>(), valuesLength);
  if (!values) return Napi::Array::New(env);
  {
    std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
    char err[tspice_backend_node::kErrMaxBytes];
    const int status = tspice_cleard(ndim, values.get(), valuesLength, err, static_cast<int>(sizeof(err)));
    if (status != 0) {
      ThrowSpiceError(env, "CSPICE failed while calling cleard", err);
      return Napi::Array::New(env);
    }
  }
  return StorageResult(env, values.get(), valuesLength);
}

static Napi::Array Cleari(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "cleari() expects 2 arguments"));
    return Napi::Array::New(env);
  }
  int ndim = 0;
  if (!ReadStorageNumber(env, info[0], &ndim)) return Napi::Array::New(env);
  int valuesLength = 0;
  if (!ReadStorageLength(env, info[1], sizeof(int), &valuesLength)) return Napi::Array::New(env);
  if (ndim > valuesLength) {
    ThrowSpiceError(Napi::RangeError::New(env, "cleari() count does not fit the supplied storage"));
    return Napi::Array::New(env);
  }
  auto values = CopyStorageArray<int>(env, info[1].As<Napi::Array>(), valuesLength);
  if (!values) return Napi::Array::New(env);
  {
    std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
    char err[tspice_backend_node::kErrMaxBytes];
    const int status = tspice_cleari(ndim, values.get(), valuesLength, err, static_cast<int>(sizeof(err)));
    if (status != 0) {
      ThrowSpiceError(env, "CSPICE failed while calling cleari", err);
      return Napi::Array::New(env);
    }
  }
  return StorageResult(env, values.get(), valuesLength);
}

static Napi::Array Filld(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "filld() expects 3 arguments"));
    return Napi::Array::New(env);
  }
  double value = 0;
  if (!ReadStorageNumber(env, info[0], &value)) return Napi::Array::New(env);
  int ndim = 0;
  if (!ReadStorageNumber(env, info[1], &ndim)) return Napi::Array::New(env);
  int valuesLength = 0;
  if (!ReadStorageLength(env, info[2], sizeof(double), &valuesLength)) return Napi::Array::New(env);
  if (ndim > valuesLength) {
    ThrowSpiceError(Napi::RangeError::New(env, "filld() count does not fit the supplied storage"));
    return Napi::Array::New(env);
  }
  auto values = CopyStorageArray<double>(env, info[2].As<Napi::Array>(), valuesLength);
  if (!values) return Napi::Array::New(env);
  {
    std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
    char err[tspice_backend_node::kErrMaxBytes];
    const int status = tspice_filld(value, ndim, values.get(), valuesLength, err, static_cast<int>(sizeof(err)));
    if (status != 0) {
      ThrowSpiceError(env, "CSPICE failed while calling filld", err);
      return Napi::Array::New(env);
    }
  }
  return StorageResult(env, values.get(), valuesLength);
}

static Napi::Array Filli(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "filli() expects 3 arguments"));
    return Napi::Array::New(env);
  }
  int value = 0;
  if (!ReadStorageNumber(env, info[0], &value)) return Napi::Array::New(env);
  int ndim = 0;
  if (!ReadStorageNumber(env, info[1], &ndim)) return Napi::Array::New(env);
  int valuesLength = 0;
  if (!ReadStorageLength(env, info[2], sizeof(int), &valuesLength)) return Napi::Array::New(env);
  if (ndim > valuesLength) {
    ThrowSpiceError(Napi::RangeError::New(env, "filli() count does not fit the supplied storage"));
    return Napi::Array::New(env);
  }
  auto values = CopyStorageArray<int>(env, info[2].As<Napi::Array>(), valuesLength);
  if (!values) return Napi::Array::New(env);
  {
    std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
    char err[tspice_backend_node::kErrMaxBytes];
    const int status = tspice_filli(value, ndim, values.get(), valuesLength, err, static_cast<int>(sizeof(err)));
    if (status != 0) {
      ThrowSpiceError(env, "CSPICE failed while calling filli", err);
      return Napi::Array::New(env);
    }
  }
  return StorageResult(env, values.get(), valuesLength);
}

static Napi::Array Moved(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "moved() expects 3 arguments"));
    return Napi::Array::New(env);
  }
  int sourceLength = 0;
  if (!ReadStorageLength(env, info[0], sizeof(double), &sourceLength)) return Napi::Array::New(env);
  int ndim = 0;
  if (!ReadStorageNumber(env, info[1], &ndim)) return Napi::Array::New(env);
  int destinationLength = 0;
  if (!ReadStorageLength(env, info[2], sizeof(double), &destinationLength)) return Napi::Array::New(env);
  if (ndim < 0 || ndim > sourceLength || ndim > destinationLength) {
    ThrowSpiceError(Napi::RangeError::New(env, "moved() count does not fit the supplied storage"));
    return Napi::Array::New(env);
  }
  auto source = CopyStorageArray<double>(env, info[0].As<Napi::Array>(), sourceLength);
  if (!source) return Napi::Array::New(env);
  auto destination = CopyStorageArray<double>(env, info[2].As<Napi::Array>(), destinationLength);
  if (!destination) return Napi::Array::New(env);
  {
    std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
    char err[tspice_backend_node::kErrMaxBytes];
    const int status = tspice_moved(source.get(), sourceLength, ndim, destination.get(), destinationLength, err, static_cast<int>(sizeof(err)));
    if (status != 0) {
      ThrowSpiceError(env, "CSPICE failed while calling moved", err);
      return Napi::Array::New(env);
    }
  }
  return StorageResult(env, destination.get(), destinationLength);
}

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

static bool ReadMatrixDimension(Napi::Env env, const Napi::Value& value, int *out) {
  if (value.IsNumber()) {
    const double number = value.As<Napi::Number>().DoubleValue();
    if (number >= INT32_MIN && number <= INT32_MAX && std::trunc(number) == number) {
      *out = static_cast<int>(number);
      return true;
    }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Matrix dimension must be a signed 32-bit integer"));
  return false;
}

static bool CheckMatrixLength(Napi::Env env, const Napi::Value& source, int count) {
  if (!source.IsArray() || source.As<Napi::Array>().Length() != static_cast<uint32_t>(count)) {
    ThrowSpiceError(Napi::TypeError::New(env, "Flat matrix or vector input has an incorrect length"));
    return false;
  }
  return true;
}

static std::unique_ptr<double[]> MatrixStorage(Napi::Env env, int count) {
  // N0067 expects non-null pointers even when the logical array is empty.
  std::unique_ptr<double[]> out(new (std::nothrow) double[std::max(1, count)]);
  if (!out) ThrowSpiceError(Napi::Error::New(env, "Unable to allocate matrix storage"));
  return out;
}

static bool CopyMatrixInput(Napi::Env env, const Napi::Value& source, int count, double *out) {
  const auto array = source.As<Napi::Array>();
  for (int i = 0; i < count; ++i) {
    if (!ReadGeneralVectorScalar(env, array.Get(static_cast<uint32_t>(i)), &out[i], "matrix component")) return false;
  }
  return true;
}

static Napi::Value Mequg(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "mequg: incorrect argument count"));
    return env.Undefined();
  }
  int nr;
  if (!ReadMatrixDimension(env, info[1], &nr)) return env.Undefined();
  int nc;
  if (!ReadMatrixDimension(env, info[2], &nc)) return env.Undefined();
  int m1Count, outCount;
  if (!tspice_matrix_count(nr, nc, &m1Count) ||
      !tspice_matrix_count(nr, nc, &outCount)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Matrix dimension or buffer exceeds supported bounds"));
    return env.Undefined();
  }
  if (!CheckMatrixLength(env, info[0], m1Count)) return env.Undefined();
  auto m1 = MatrixStorage(env, m1Count);
  if (!m1 || !CopyMatrixInput(env, info[0], m1Count, m1.get())) return env.Undefined();
  auto out = MatrixStorage(env, outCount);
  if (!out) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_mequg(m1.get(), nr, nc, out.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "mequg", err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out.get(),static_cast<size_t>(outCount));
}

static Napi::Value Mtxmg(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "mtxmg: incorrect argument count"));
    return env.Undefined();
  }
  int nc1;
  if (!ReadMatrixDimension(env, info[2], &nc1)) return env.Undefined();
  int nr1r2;
  if (!ReadMatrixDimension(env, info[3], &nr1r2)) return env.Undefined();
  int nc2;
  if (!ReadMatrixDimension(env, info[4], &nc2)) return env.Undefined();
  const int k = nr1r2 < 0 ? 0 : nr1r2;
  int m1Count, m2Count, outCount;
  if (nc1 > TSPICE_MATRIX_MAX_ELEMENTS ||
      !tspice_matrix_count(k, nc1, &m1Count) ||
      !tspice_matrix_count(k, nc2, &m2Count) ||
      !tspice_matrix_count(nc1, nc2, &outCount)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Matrix dimension or buffer exceeds supported bounds"));
    return env.Undefined();
  }
  if (!CheckMatrixLength(env, info[0], m1Count)) return env.Undefined();
  if (!CheckMatrixLength(env, info[1], m2Count)) return env.Undefined();
  auto m1 = MatrixStorage(env, m1Count);
  if (!m1 || !CopyMatrixInput(env, info[0], m1Count, m1.get())) return env.Undefined();
  auto m2 = MatrixStorage(env, m2Count);
  if (!m2 || !CopyMatrixInput(env, info[1], m2Count, m2.get())) return env.Undefined();
  auto out = MatrixStorage(env, outCount);
  if (!out) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_mtxmg(m1.get(), m2.get(), nc1, nr1r2, nc2, out.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "mtxmg", err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out.get(),static_cast<size_t>(outCount));
}

static Napi::Value Mtxvg(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "mtxvg: incorrect argument count"));
    return env.Undefined();
  }
  int nc1;
  if (!ReadMatrixDimension(env, info[2], &nc1)) return env.Undefined();
  int nr1r2;
  if (!ReadMatrixDimension(env, info[3], &nr1r2)) return env.Undefined();
  int m1Count, v2Count, outCount;
  if (!tspice_matrix_count(nr1r2, nc1, &m1Count) ||
      !tspice_matrix_count(nr1r2, 1, &v2Count) ||
      !tspice_matrix_count(nc1, 1, &outCount)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Matrix dimension or buffer exceeds supported bounds"));
    return env.Undefined();
  }
  if (!CheckMatrixLength(env, info[0], m1Count)) return env.Undefined();
  if (!CheckMatrixLength(env, info[1], v2Count)) return env.Undefined();
  auto m1 = MatrixStorage(env, m1Count);
  if (!m1 || !CopyMatrixInput(env, info[0], m1Count, m1.get())) return env.Undefined();
  auto v2 = MatrixStorage(env, v2Count);
  if (!v2 || !CopyMatrixInput(env, info[1], v2Count, v2.get())) return env.Undefined();
  auto out = MatrixStorage(env, outCount);
  if (!out) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_mtxvg(m1.get(), v2.get(), nc1, nr1r2, out.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "mtxvg", err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out.get(),static_cast<size_t>(outCount));
}

static Napi::Value Mxmg(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "mxmg: incorrect argument count"));
    return env.Undefined();
  }
  int nr1;
  if (!ReadMatrixDimension(env, info[2], &nr1)) return env.Undefined();
  int nc1r2;
  if (!ReadMatrixDimension(env, info[3], &nc1r2)) return env.Undefined();
  int nc2;
  if (!ReadMatrixDimension(env, info[4], &nc2)) return env.Undefined();
  const int k = nc1r2 < 0 ? 0 : nc1r2;
  int m1Count, m2Count, outCount;
  if (nr1 > TSPICE_MATRIX_MAX_ELEMENTS ||
      !tspice_matrix_count(nr1, k, &m1Count) ||
      !tspice_matrix_count(k, nc2, &m2Count) ||
      !tspice_matrix_count(nr1, nc2, &outCount)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Matrix dimension or buffer exceeds supported bounds"));
    return env.Undefined();
  }
  if (!CheckMatrixLength(env, info[0], m1Count)) return env.Undefined();
  if (!CheckMatrixLength(env, info[1], m2Count)) return env.Undefined();
  auto m1 = MatrixStorage(env, m1Count);
  if (!m1 || !CopyMatrixInput(env, info[0], m1Count, m1.get())) return env.Undefined();
  auto m2 = MatrixStorage(env, m2Count);
  if (!m2 || !CopyMatrixInput(env, info[1], m2Count, m2.get())) return env.Undefined();
  auto out = MatrixStorage(env, outCount);
  if (!out) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_mxmg(m1.get(), m2.get(), nr1, nc1r2, nc2, out.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "mxmg", err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out.get(),static_cast<size_t>(outCount));
}

static Napi::Value Mxmtg(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "mxmtg: incorrect argument count"));
    return env.Undefined();
  }
  int nr1;
  if (!ReadMatrixDimension(env, info[2], &nr1)) return env.Undefined();
  int nc1c2;
  if (!ReadMatrixDimension(env, info[3], &nc1c2)) return env.Undefined();
  int nr2;
  if (!ReadMatrixDimension(env, info[4], &nr2)) return env.Undefined();
  int m1Count, m2Count, outCount;
  if (nr1 > TSPICE_MATRIX_MAX_ELEMENTS ||
      !tspice_matrix_count(nr1, nc1c2, &m1Count) ||
      !tspice_matrix_count(nr2, nc1c2, &m2Count) ||
      !tspice_matrix_count(nr1, nr2, &outCount)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Matrix dimension or buffer exceeds supported bounds"));
    return env.Undefined();
  }
  if (!CheckMatrixLength(env, info[0], m1Count)) return env.Undefined();
  if (!CheckMatrixLength(env, info[1], m2Count)) return env.Undefined();
  auto m1 = MatrixStorage(env, m1Count);
  if (!m1 || !CopyMatrixInput(env, info[0], m1Count, m1.get())) return env.Undefined();
  auto m2 = MatrixStorage(env, m2Count);
  if (!m2 || !CopyMatrixInput(env, info[1], m2Count, m2.get())) return env.Undefined();
  auto out = MatrixStorage(env, outCount);
  if (!out) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_mxmtg(m1.get(), m2.get(), nr1, nc1c2, nr2, out.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "mxmtg", err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out.get(),static_cast<size_t>(outCount));
}

static Napi::Value Mxvg(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "mxvg: incorrect argument count"));
    return env.Undefined();
  }
  int nr1;
  if (!ReadMatrixDimension(env, info[2], &nr1)) return env.Undefined();
  int nc1r2;
  if (!ReadMatrixDimension(env, info[3], &nc1r2)) return env.Undefined();
  int m1Count, v2Count, outCount;
  if (!tspice_matrix_count(nr1, nc1r2, &m1Count) ||
      !tspice_matrix_count(nc1r2, 1, &v2Count) ||
      !tspice_matrix_count(nr1, 1, &outCount)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Matrix dimension or buffer exceeds supported bounds"));
    return env.Undefined();
  }
  if (!CheckMatrixLength(env, info[0], m1Count)) return env.Undefined();
  if (!CheckMatrixLength(env, info[1], v2Count)) return env.Undefined();
  auto m1 = MatrixStorage(env, m1Count);
  if (!m1 || !CopyMatrixInput(env, info[0], m1Count, m1.get())) return env.Undefined();
  auto v2 = MatrixStorage(env, v2Count);
  if (!v2 || !CopyMatrixInput(env, info[1], v2Count, v2.get())) return env.Undefined();
  auto out = MatrixStorage(env, outCount);
  if (!out) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_mxvg(m1.get(), v2.get(), nr1, nc1r2, out.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "mxvg", err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out.get(),static_cast<size_t>(outCount));
}

static Napi::Value Vtmvg(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "vtmvg: incorrect argument count"));
    return env.Undefined();
  }
  int nrow;
  if (!ReadMatrixDimension(env, info[3], &nrow)) return env.Undefined();
  int ncol;
  if (!ReadMatrixDimension(env, info[4], &ncol)) return env.Undefined();
  int v1Count, matrixCount, v2Count, outCount;
  if (!tspice_matrix_count(nrow, 1, &v1Count) ||
      !tspice_matrix_count(nrow, ncol, &matrixCount) ||
      !tspice_matrix_count(ncol, 1, &v2Count) ||
      !tspice_matrix_count(1, 1, &outCount)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Matrix dimension or buffer exceeds supported bounds"));
    return env.Undefined();
  }
  if (!CheckMatrixLength(env, info[0], v1Count)) return env.Undefined();
  if (!CheckMatrixLength(env, info[1], matrixCount)) return env.Undefined();
  if (!CheckMatrixLength(env, info[2], v2Count)) return env.Undefined();
  auto v1 = MatrixStorage(env, v1Count);
  if (!v1 || !CopyMatrixInput(env, info[0], v1Count, v1.get())) return env.Undefined();
  auto matrix = MatrixStorage(env, matrixCount);
  if (!matrix || !CopyMatrixInput(env, info[1], matrixCount, matrix.get())) return env.Undefined();
  auto v2 = MatrixStorage(env, v2Count);
  if (!v2 || !CopyMatrixInput(env, info[2], v2Count, v2.get())) return env.Undefined();
  auto out = MatrixStorage(env, outCount);
  if (!out) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_vtmvg(v1.get(), matrix.get(), v2.get(), nrow, ncol, out.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "vtmvg", err);
    return env.Undefined();
  }
  return Napi::Number::New(env,out[0]);
}

static Napi::Value Xposeg(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "xposeg: incorrect argument count"));
    return env.Undefined();
  }
  int nrow;
  if (!ReadMatrixDimension(env, info[1], &nrow)) return env.Undefined();
  int ncol;
  if (!ReadMatrixDimension(env, info[2], &ncol)) return env.Undefined();
  const int r = nrow <= 0 || ncol <= 0 ? 0 : nrow;
  const int c = r == 0 ? 0 : ncol;
  int matrixCount, outCount;
  if (!tspice_matrix_count(r, c, &matrixCount) ||
      !tspice_matrix_count(r, c, &outCount)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Matrix dimension or buffer exceeds supported bounds"));
    return env.Undefined();
  }
  if (!CheckMatrixLength(env, info[0], matrixCount)) return env.Undefined();
  auto matrix = MatrixStorage(env, matrixCount);
  if (!matrix || !CopyMatrixInput(env, info[0], matrixCount, matrix.get())) return env.Undefined();
  auto out = MatrixStorage(env, outCount);
  if (!out) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_xposeg(matrix.get(), nrow, ncol, out.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "xposeg", err);
    return env.Undefined();
  }
  return MakeNumberArray(env,out.get(),static_cast<size_t>(outCount));
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
  if (!SetExportChecked(env, exports, "hrmesp", Napi::Function::New(env, Hrmesp), __func__)) return;
  if (!SetExportChecked(env, exports, "hrmint", Napi::Function::New(env, Hrmint), __func__)) return;
  if (!SetExportChecked(env, exports, "lgresp", Napi::Function::New(env, Lgresp), __func__)) return;
  if (!SetExportChecked(env, exports, "lgrind", Napi::Function::New(env, Lgrind), __func__)) return;
  if (!SetExportChecked(env, exports, "lgrint", Napi::Function::New(env, Lgrint), __func__)) return;
  if (!SetExportChecked(env, exports, "qderiv", Napi::Function::New(env, Qderiv), __func__)) return;
  if (!SetExportChecked(env, exports, "clearc", Napi::Function::New(env, Clearc), __func__)) return;
  if (!SetExportChecked(env, exports, "cleard", Napi::Function::New(env, Cleard), __func__)) return;
  if (!SetExportChecked(env, exports, "cleari", Napi::Function::New(env, Cleari), __func__)) return;
  if (!SetExportChecked(env, exports, "filld", Napi::Function::New(env, Filld), __func__)) return;
  if (!SetExportChecked(env, exports, "filli", Napi::Function::New(env, Filli), __func__)) return;
  if (!SetExportChecked(env, exports, "moved", Napi::Function::New(env, Moved), __func__)) return;
  if (!SetExportChecked(env, exports, "eul2m", Napi::Function::New(env,Eul2m), __func__)) return;
  if (!SetExportChecked(env, exports, "m2eul", Napi::Function::New(env,M2eul), __func__)) return;
  if (!SetExportChecked(env, exports, "m2q", Napi::Function::New(env,M2q), __func__)) return;
  if (!SetExportChecked(env, exports, "q2m", Napi::Function::New(env,Q2m), __func__)) return;
  if (!SetExportChecked(env, exports, "qxq", Napi::Function::New(env,Qxq), __func__)) return;
  if (!SetExportChecked(env, exports, "qdq2av", Napi::Function::New(env,Qdq2av), __func__)) return;
  if (!SetExportChecked(env, exports, "raxisa", Napi::Function::New(env,Raxisa), __func__)) return;
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
  if (!SetExportChecked(env, exports, "mequg", Napi::Function::New(env, Mequg), __func__)) return;
  if (!SetExportChecked(env, exports, "mtxmg", Napi::Function::New(env, Mtxmg), __func__)) return;
  if (!SetExportChecked(env, exports, "mtxvg", Napi::Function::New(env, Mtxvg), __func__)) return;
  if (!SetExportChecked(env, exports, "mxmg", Napi::Function::New(env, Mxmg), __func__)) return;
  if (!SetExportChecked(env, exports, "mxmtg", Napi::Function::New(env, Mxmtg), __func__)) return;
  if (!SetExportChecked(env, exports, "mxvg", Napi::Function::New(env, Mxvg), __func__)) return;
  if (!SetExportChecked(env, exports, "vtmvg", Napi::Function::New(env, Vtmvg), __func__)) return;
  if (!SetExportChecked(env, exports, "xposeg", Napi::Function::New(env, Xposeg), __func__)) return;
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
