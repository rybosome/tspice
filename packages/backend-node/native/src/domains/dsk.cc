#include "dsk.h"

#include <memory>
#include <new>
#include <type_traits>
#include <cmath>
#include <cstdint>
#include <limits>
#include <string>

#include "../addon_common.h"
#include "../cell_handles.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

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

static bool ReadDlaDescriptorField(
    Napi::Env env,
    const Napi::Object& obj,
    const char* key,
    int32_t* out) {
  if (!obj.Has(key)) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Missing DLA descriptor field: ") + key));
    return false;
  }

  const Napi::Value value = obj.Get(key);
  const std::string label = std::string("DLA descriptor field '") + key + "'";
  return ReadInt32Checked(env, value, label.c_str(), out);
}

static bool ReadDlaDescriptor(Napi::Env env, const Napi::Value& value, int32_t outDescr8[8]) {
  if (!value.IsObject()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected DLA descriptor to be an object"));
    return false;
  }
  const Napi::Object obj = value.As<Napi::Object>();

  return ReadDlaDescriptorField(env, obj, "bwdptr", &outDescr8[0]) &&
      ReadDlaDescriptorField(env, obj, "fwdptr", &outDescr8[1]) &&
      ReadDlaDescriptorField(env, obj, "ibase", &outDescr8[2]) &&
      ReadDlaDescriptorField(env, obj, "isize", &outDescr8[3]) &&
      ReadDlaDescriptorField(env, obj, "dbase", &outDescr8[4]) &&
      ReadDlaDescriptorField(env, obj, "dsize", &outDescr8[5]) &&
      ReadDlaDescriptorField(env, obj, "cbase", &outDescr8[6]) &&
      ReadDlaDescriptorField(env, obj, "csize", &outDescr8[7]);
}

static Napi::Value Dskobj(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dskobj(dsk: string, bodids: SpiceIntCell) expects (string, handle)"));
    return env.Undefined();
  }

  const std::string dsk = info[0].As<Napi::String>().Utf8Value();
  uint32_t cellHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "bodids", &cellHandle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t cellPtr =
      tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, cellHandle, SPICE_INT, "dskobj(bodids)", "SpiceIntCell");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_dskobj(dsk.c_str(), cellPtr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dskobj", err);
  }
  return env.Undefined();
}

static Napi::Value Dsksrf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[0].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "dsksrf(dsk: string, bodyid: number, srfids: SpiceIntCell) expects 3 args"));
    return env.Undefined();
  }

  const std::string dsk = info[0].As<Napi::String>().Utf8Value();

  int32_t bodyid = 0;
  if (!ReadInt32Checked(env, info[1], "bodyid", &bodyid)) {
    return env.Undefined();
  }

  uint32_t cellHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "srfids", &cellHandle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t cellPtr =
      tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, cellHandle, SPICE_INT, "dsksrf(srfids)", "SpiceIntCell");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_dsksrf(dsk.c_str(), bodyid, cellPtr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dsksrf", err);
  }
  return env.Undefined();
}

static Napi::Value Dskgd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "dskgd(handle: SpiceHandle, dladsc: DlaDescriptor) expects 2 args"));
    return env.Undefined();
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return env.Undefined();
  }

  int32_t descr8[8];
  if (!ReadDlaDescriptor(env, info[1], descr8)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];

  int32_t outInts6[6];
  double outDoubles18[18];

  const int code = tspice_dskgd(handle, descr8, outInts6, outDoubles18, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dskgd", err);
    return env.Undefined();
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("surfce", Napi::Number::New(env, (double)outInts6[0]));
  result.Set("center", Napi::Number::New(env, (double)outInts6[1]));
  result.Set("dclass", Napi::Number::New(env, (double)outInts6[2]));
  result.Set("dtype", Napi::Number::New(env, (double)outInts6[3]));
  result.Set("frmcde", Napi::Number::New(env, (double)outInts6[4]));
  result.Set("corsys", Napi::Number::New(env, (double)outInts6[5]));

  Napi::Array corpar = Napi::Array::New(env, 10);
  for (uint32_t i = 0; i < 10; i++) {
    corpar.Set(i, Napi::Number::New(env, outDoubles18[i]));
  }
  result.Set("corpar", corpar);
  result.Set("co1min", Napi::Number::New(env, outDoubles18[10]));
  result.Set("co1max", Napi::Number::New(env, outDoubles18[11]));
  result.Set("co2min", Napi::Number::New(env, outDoubles18[12]));
  result.Set("co2max", Napi::Number::New(env, outDoubles18[13]));
  result.Set("co3min", Napi::Number::New(env, outDoubles18[14]));
  result.Set("co3max", Napi::Number::New(env, outDoubles18[15]));
  result.Set("start", Napi::Number::New(env, outDoubles18[16]));
  result.Set("stop", Napi::Number::New(env, outDoubles18[17]));

  return result;
}

static Napi::Value Dskb02(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "dskb02(handle: SpiceHandle, dladsc: DlaDescriptor) expects 2 args"));
    return env.Undefined();
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return env.Undefined();
  }

  int32_t descr8[8];
  if (!ReadDlaDescriptor(env, info[1], descr8)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];

  int32_t outInts10[10];
  double outDoubles10[10];

  const int code = tspice_dskb02(handle, descr8, outInts10, outDoubles10, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dskb02", err);
    return env.Undefined();
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("nv", Napi::Number::New(env, (double)outInts10[0]));
  result.Set("np", Napi::Number::New(env, (double)outInts10[1]));
  result.Set("nvxtot", Napi::Number::New(env, (double)outInts10[2]));

  // vtxbds: [[xmin,xmax],[ymin,ymax],[zmin,zmax]]
  Napi::Array vtxbds = Napi::Array::New(env, 3);
  {
    Napi::Array x = Napi::Array::New(env, 2);
    x.Set((uint32_t)0, Napi::Number::New(env, outDoubles10[0]));
    x.Set((uint32_t)1, Napi::Number::New(env, outDoubles10[1]));
    vtxbds.Set((uint32_t)0, x);
  }
  {
    Napi::Array y = Napi::Array::New(env, 2);
    y.Set((uint32_t)0, Napi::Number::New(env, outDoubles10[2]));
    y.Set((uint32_t)1, Napi::Number::New(env, outDoubles10[3]));
    vtxbds.Set((uint32_t)1, y);
  }
  {
    Napi::Array z = Napi::Array::New(env, 2);
    z.Set((uint32_t)0, Napi::Number::New(env, outDoubles10[4]));
    z.Set((uint32_t)1, Napi::Number::New(env, outDoubles10[5]));
    vtxbds.Set((uint32_t)2, z);
  }
  result.Set("vtxbds", vtxbds);

  result.Set("voxsiz", Napi::Number::New(env, outDoubles10[6]));

  Napi::Array voxori = Napi::Array::New(env, 3);
  voxori.Set((uint32_t)0, Napi::Number::New(env, outDoubles10[7]));
  voxori.Set((uint32_t)1, Napi::Number::New(env, outDoubles10[8]));
  voxori.Set((uint32_t)2, Napi::Number::New(env, outDoubles10[9]));
  result.Set("voxori", voxori);

  Napi::Array vgrext = Napi::Array::New(env, 3);
  vgrext.Set((uint32_t)0, Napi::Number::New(env, (double)outInts10[3]));
  vgrext.Set((uint32_t)1, Napi::Number::New(env, (double)outInts10[4]));
  vgrext.Set((uint32_t)2, Napi::Number::New(env, (double)outInts10[5]));
  result.Set("vgrext", vgrext);

  result.Set("cgscal", Napi::Number::New(env, (double)outInts10[6]));
  result.Set("vtxnpl", Napi::Number::New(env, (double)outInts10[7]));
  result.Set("voxnpt", Napi::Number::New(env, (double)outInts10[8]));
  result.Set("voxnpl", Napi::Number::New(env, (double)outInts10[9]));

  return result;
}

template <typename T>
static bool ReadPlateArray(Napi::Env env, const Napi::Value& input, size_t exact, bool triples,
                           std::unique_ptr<T[]>* out, int* count) {
  if (!input.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a numeric array"));
    return false;
  }
  auto a = input.As<Napi::Array>();
  const size_t n = a.Length();
  if (n > INT32_MAX / sizeof(T) || (exact && n != exact) || (triples && n % 3)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid plate buffer length"));
    return false;
  }
  *count = static_cast<int>(n);
  out->reset(new (std::nothrow) T[n ? n : 1]());
  if (!*out) {
    ThrowSpiceError(env, "Plate buffer allocation failed");
    return false;
  }
  for (uint32_t i = 0; i < n; ++i) {
    auto value = a.Get(i);
    if (env.IsExceptionPending()) return false;
    if (!value.IsNumber()) {
      ThrowSpiceError(env, "Expected numeric plate entry");
      return false;
    }
    double d = value.As<Napi::Number>().DoubleValue();
    if (!std::isfinite(d) ||
        (std::is_integral_v<T> && (d < INT32_MIN || d > INT32_MAX || std::floor(d) != d))) {
      ThrowSpiceError(env, "Invalid plate array entry");
      return false;
    }
    (*out)[i] = static_cast<T>(d);
  }
  return true;
}

static Napi::Value Pltar(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(env, "Invalid argument count for pltar");
    return env.Undefined();
  }
  std::unique_ptr<double[]> vertices;
  int nvertices;
  if (!ReadPlateArray(env, info[0], 0, true, &vertices, &nvertices)) return env.Undefined();
  std::unique_ptr<int[]> plates;
  int nplates;
  if (!ReadPlateArray(env, info[1], 0, true, &plates, &nplates)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double out[1] = {};
  if (tspice_pltar(nvertices / 3, vertices.get(), nplates / 3, plates.get(), out, err,
                   sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling pltar", err, "pltar");
    return env.Undefined();
  }
  return tspice_napi::MakeNumberArray(env, out, 1);
}

static Napi::Value Pltexp(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(env, "Invalid argument count for pltexp");
    return env.Undefined();
  }
  std::unique_ptr<double[]> iverts;
  int niverts;
  if (!ReadPlateArray(env, info[0], 9, false, &iverts, &niverts)) return env.Undefined();
  if (!info[1].IsNumber()) {
    ThrowSpiceError(env, "Expected finite delta");
    return env.Undefined();
  }
  double delta = info[1].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(delta)) {
    ThrowSpiceError(env, "Expected finite delta");
    return env.Undefined();
  }
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double out[9] = {};
  if (tspice_pltexp(iverts.get(), delta, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling pltexp", err, "pltexp");
    return env.Undefined();
  }
  return tspice_napi::MakeNumberArray(env, out, 9);
}

static Napi::Value Pltnp(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(env, "Invalid argument count for pltnp");
    return env.Undefined();
  }
  std::unique_ptr<double[]> point;
  int npoint;
  if (!ReadPlateArray(env, info[0], 3, false, &point, &npoint)) return env.Undefined();
  std::unique_ptr<double[]> v1;
  int nv1;
  if (!ReadPlateArray(env, info[1], 3, false, &v1, &nv1)) return env.Undefined();
  std::unique_ptr<double[]> v2;
  int nv2;
  if (!ReadPlateArray(env, info[2], 3, false, &v2, &nv2)) return env.Undefined();
  std::unique_ptr<double[]> v3;
  int nv3;
  if (!ReadPlateArray(env, info[3], 3, false, &v3, &nv3)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double out[4] = {};
  if (tspice_pltnp(point.get(), v1.get(), v2.get(), v3.get(), out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling pltnp", err, "pltnp");
    return env.Undefined();
  }
  return tspice_napi::MakeNumberArray(env, out, 4);
}

static Napi::Value Pltnrm(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(env, "Invalid argument count for pltnrm");
    return env.Undefined();
  }
  std::unique_ptr<double[]> v1;
  int nv1;
  if (!ReadPlateArray(env, info[0], 3, false, &v1, &nv1)) return env.Undefined();
  std::unique_ptr<double[]> v2;
  int nv2;
  if (!ReadPlateArray(env, info[1], 3, false, &v2, &nv2)) return env.Undefined();
  std::unique_ptr<double[]> v3;
  int nv3;
  if (!ReadPlateArray(env, info[2], 3, false, &v3, &nv3)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double out[3] = {};
  if (tspice_pltnrm(v1.get(), v2.get(), v3.get(), out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling pltnrm", err, "pltnrm");
    return env.Undefined();
  }
  return tspice_napi::MakeNumberArray(env, out, 3);
}

static Napi::Value Pltvol(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(env, "Invalid argument count for pltvol");
    return env.Undefined();
  }
  std::unique_ptr<double[]> vertices;
  int nvertices;
  if (!ReadPlateArray(env, info[0], 0, true, &vertices, &nvertices)) return env.Undefined();
  std::unique_ptr<int[]> plates;
  int nplates;
  if (!ReadPlateArray(env, info[1], 0, true, &plates, &nplates)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double out[1] = {};
  if (tspice_pltvol(nvertices / 3, vertices.get(), nplates / 3, plates.get(), out, err,
                    sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling pltvol", err, "pltvol");
    return env.Undefined();
  }
  return tspice_napi::MakeNumberArray(env, out, 1);
}

static Napi::Value Dskrb2(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(env, "Invalid argument count for dskrb2");
    return env.Undefined();
  }
  std::unique_ptr<double[]> vertices;
  int nvertices;
  if (!ReadPlateArray(env, info[0], 0, true, &vertices, &nvertices)) return env.Undefined();
  std::unique_ptr<int[]> plates;
  int nplates;
  if (!ReadPlateArray(env, info[1], 0, true, &plates, &nplates)) return env.Undefined();
  int32_t corsys;
  if (!ReadInt32Checked(env, info[2], "corsys", &corsys)) return env.Undefined();
  std::unique_ptr<double[]> corpar;
  int ncorpar;
  if (!ReadPlateArray(env, info[3], 0, false, &corpar, &ncorpar)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  double out[2] = {};
  if (tspice_dskrb2(nvertices / 3, vertices.get(), nplates / 3, plates.get(), corsys, ncorpar,
                    corpar.get(), out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dskrb2", err, "dskrb2");
    return env.Undefined();
  }
  return tspice_napi::MakeNumberArray(env, out, 2);
}

namespace tspice_backend_node {

void RegisterDsk(Napi::Env env, Napi::Object exports) {
  SetExportChecked(env, exports, "pltar", Napi::Function::New(env, Pltar), "RegisterDsk");
  SetExportChecked(env, exports, "pltexp", Napi::Function::New(env, Pltexp), "RegisterDsk");
  SetExportChecked(env, exports, "pltnp", Napi::Function::New(env, Pltnp), "RegisterDsk");
  SetExportChecked(env, exports, "pltnrm", Napi::Function::New(env, Pltnrm), "RegisterDsk");
  SetExportChecked(env, exports, "pltvol", Napi::Function::New(env, Pltvol), "RegisterDsk");
  SetExportChecked(env, exports, "dskrb2", Napi::Function::New(env, Dskrb2), "RegisterDsk");
  SetExportChecked(env, exports, "dskobj", Napi::Function::New(env, Dskobj), "RegisterDsk");
  SetExportChecked(env, exports, "dsksrf", Napi::Function::New(env, Dsksrf), "RegisterDsk");
  SetExportChecked(env, exports, "dskgd", Napi::Function::New(env, Dskgd), "RegisterDsk");
  SetExportChecked(env, exports, "dskb02", Napi::Function::New(env, Dskb02), "RegisterDsk");
}

}  // namespace tspice_backend_node
