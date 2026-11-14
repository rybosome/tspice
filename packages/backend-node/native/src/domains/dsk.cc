#include "dsk.h"

#include <vector>
#include <memory>
#include <new>
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

static Napi::Value Dskd02(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(env, "Expected 5 arguments for dskd02");
    return env.Undefined();
  }
  int32_t handle;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return env.Undefined();
  int32_t descr[8];
  if (!ReadDlaDescriptor(env, info[1], descr)) return env.Undefined();
  int32_t item;
  if (!ReadInt32Checked(env, info[2], "item", &item)) return env.Undefined();
  int32_t start;
  if (!ReadInt32Checked(env, info[3], "start", &start)) return env.Undefined();
  int32_t room;
  if (!ReadInt32Checked(env, info[4], "room", &room)) return env.Undefined();
  int64_t words =
      std::max<int64_t>(1, std::min<int64_t>(std::max(1, room), std::max(1, descr[5] / 1)) * 1);
  if (words > INT32_MAX / (int)sizeof(double)) {
    ThrowSpiceError(env, "DSK page exceeds native buffer limit");
    return env.Undefined();
  }
  int count = 0;
  std::unique_ptr<double[]> out(new (std::nothrow) double[words]());
  if (!out) {
    ThrowSpiceError(env, "DSK page allocation failed");
    return env.Undefined();
  }
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_dskd02(handle, descr, item, start, room, static_cast<int>(words), &count, out.get(),
                    err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dskd02", err, "dskd02");
    return env.Undefined();
  }
  Napi::Array result = Napi::Array::New(env, count * 1);
  for (int i = 0; i < count * 1; ++i) result.Set((uint32_t)i, Napi::Number::New(env, out[i]));
  return result;
}

static Napi::Value Dski02(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(env, "Expected 5 arguments for dski02");
    return env.Undefined();
  }
  int32_t handle;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return env.Undefined();
  int32_t descr[8];
  if (!ReadDlaDescriptor(env, info[1], descr)) return env.Undefined();
  int32_t item;
  if (!ReadInt32Checked(env, info[2], "item", &item)) return env.Undefined();
  int32_t start;
  if (!ReadInt32Checked(env, info[3], "start", &start)) return env.Undefined();
  int32_t room;
  if (!ReadInt32Checked(env, info[4], "room", &room)) return env.Undefined();
  int64_t words =
      std::max<int64_t>(1, std::min<int64_t>(std::max(1, room), std::max(1, descr[3] / 1)) * 1);
  if (words > INT32_MAX / (int)sizeof(int)) {
    ThrowSpiceError(env, "DSK page exceeds native buffer limit");
    return env.Undefined();
  }
  int count = 0;
  std::unique_ptr<int[]> out(new (std::nothrow) int[words]());
  if (!out) {
    ThrowSpiceError(env, "DSK page allocation failed");
    return env.Undefined();
  }
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_dski02(handle, descr, item, start, room, static_cast<int>(words), &count, out.get(),
                    err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dski02", err, "dski02");
    return env.Undefined();
  }
  Napi::Array result = Napi::Array::New(env, count * 1);
  for (int i = 0; i < count * 1; ++i) result.Set((uint32_t)i, Napi::Number::New(env, out[i]));
  return result;
}

static Napi::Value Dskn02(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(env, "Expected 3 arguments for dskn02");
    return env.Undefined();
  }
  int32_t handle;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return env.Undefined();
  int32_t descr[8];
  if (!ReadDlaDescriptor(env, info[1], descr)) return env.Undefined();
  int32_t plid;
  if (!ReadInt32Checked(env, info[2], "plid", &plid)) return env.Undefined();
  double out[3] = {};
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_dskn02(handle, descr, plid, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dskn02", err, "dskn02");
    return env.Undefined();
  }
  Napi::Array result = Napi::Array::New(env, 3);
  for (int i = 0; i < 3; ++i) result.Set((uint32_t)i, Napi::Number::New(env, out[i]));
  return result;
}

static Napi::Value Dskp02(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(env, "Expected 4 arguments for dskp02");
    return env.Undefined();
  }
  int32_t handle;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return env.Undefined();
  int32_t descr[8];
  if (!ReadDlaDescriptor(env, info[1], descr)) return env.Undefined();
  int32_t start;
  if (!ReadInt32Checked(env, info[2], "start", &start)) return env.Undefined();
  int32_t room;
  if (!ReadInt32Checked(env, info[3], "room", &room)) return env.Undefined();
  int64_t words =
      std::max<int64_t>(1, std::min<int64_t>(std::max(1, room), std::max(1, descr[3] / 3)) * 3);
  if (words > INT32_MAX / (int)sizeof(int)) {
    ThrowSpiceError(env, "DSK page exceeds native buffer limit");
    return env.Undefined();
  }
  int count = 0;
  std::unique_ptr<int[]> out(new (std::nothrow) int[words]());
  if (!out) {
    ThrowSpiceError(env, "DSK page allocation failed");
    return env.Undefined();
  }
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_dskp02(handle, descr, start, room, static_cast<int>(words), &count, out.get(), err,
                    sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dskp02", err, "dskp02");
    return env.Undefined();
  }
  Napi::Array result = Napi::Array::New(env, count * 3);
  for (int i = 0; i < count * 3; ++i) result.Set((uint32_t)i, Napi::Number::New(env, out[i]));
  return result;
}

static Napi::Value Dskv02(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(env, "Expected 4 arguments for dskv02");
    return env.Undefined();
  }
  int32_t handle;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return env.Undefined();
  int32_t descr[8];
  if (!ReadDlaDescriptor(env, info[1], descr)) return env.Undefined();
  int32_t start;
  if (!ReadInt32Checked(env, info[2], "start", &start)) return env.Undefined();
  int32_t room;
  if (!ReadInt32Checked(env, info[3], "room", &room)) return env.Undefined();
  int64_t words =
      std::max<int64_t>(1, std::min<int64_t>(std::max(1, room), std::max(1, descr[5] / 3)) * 3);
  if (words > INT32_MAX / (int)sizeof(double)) {
    ThrowSpiceError(env, "DSK page exceeds native buffer limit");
    return env.Undefined();
  }
  int count = 0;
  std::unique_ptr<double[]> out(new (std::nothrow) double[words]());
  if (!out) {
    ThrowSpiceError(env, "DSK page allocation failed");
    return env.Undefined();
  }
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_dskv02(handle, descr, start, room, static_cast<int>(words), &count, out.get(), err,
                    sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dskv02", err, "dskv02");
    return env.Undefined();
  }
  Napi::Array result = Napi::Array::New(env, count * 3);
  for (int i = 0; i < count * 3; ++i) result.Set((uint32_t)i, Napi::Number::New(env, out[i]));
  return result;
}

static Napi::Value Dskz02(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(env, "Expected 2 arguments for dskz02");
    return env.Undefined();
  }
  int32_t handle;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return env.Undefined();
  int32_t descr[8];
  if (!ReadDlaDescriptor(env, info[1], descr)) return env.Undefined();
  int out[2] = {};
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_dskz02(handle, descr, out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dskz02", err, "dskz02");
    return env.Undefined();
  }
  Napi::Array result = Napi::Array::New(env, 2);
  for (int i = 0; i < 2; ++i) result.Set((uint32_t)i, Napi::Number::New(env, out[i]));
  return result;
}

static Napi::Value Dskcls(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(env, "Expected 2 arguments for dskcls");
    return env.Undefined();
  }
  int32_t handle;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return env.Undefined();
  if (!info[1].IsBoolean()) {
    ThrowSpiceError(env, "Expected boolean optimize flag");
    return env.Undefined();
  }
  bool optmiz = info[1].As<Napi::Boolean>().Value();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_dskcls(handle, optmiz, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling dskcls", err, "dskcls");
    return env.Undefined();
  }
  return env.Undefined();
}

namespace tspice_backend_node {

static bool RayText(Napi::Env env, const Napi::Value &value, std::string *out) {
  if (value.IsString()) {
    *out=value.As<Napi::String>().Utf8Value();
    if (out->size()<INT32_MAX && out->find('\0')==std::string::npos) return true;
  }
  ThrowSpiceError(Napi::TypeError::New(env,"Expected NUL-free DSK text"));
  return false;
}

static bool RayArray(Napi::Env env, const Napi::Value &v, napi_typedarray_type type, size_t max,
                     size_t *length) {
  if (v.IsTypedArray()) {
    auto a=v.As<Napi::TypedArray>();
    if (a.TypedArrayType()==type && a.ElementLength()<=max) { *length=a.ElementLength(); return true; }
  }
  ThrowSpiceError(Napi::TypeError::New(env,"Invalid packed DSK array"));
  return false;
}


static bool LegacyPlateBuffer(const Napi::Value& value, napi_typedarray_type type, size_t words) {
  if (!value.IsTypedArray()) return false;
  const auto buffer=value.As<Napi::TypedArray>();
  return buffer.TypedArrayType()==type && buffer.ElementLength()==words;
}
static Napi::Value LegacyPlateInputError(Napi::Env env) {
  if (!env.IsExceptionPending()) ThrowSpiceError(Napi::TypeError::New(env,"Invalid legacy plate input or output storage"));
  return env.Undefined();
}
static Napi::Value IllumPl02(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length()!=9) return LegacyPlateInputError(env);
  int32_t handle=0;
  if (!ReadInt32Checked(env,info[0],"handle",&handle)) return env.Undefined();
  int32_t descr[8]={};
  if (!ReadDlaDescriptor(env,info[1],descr)) return env.Undefined();
  if (!info[2].IsString()) return LegacyPlateInputError(env);
  const auto target=info[2].As<Napi::String>().Utf8Value();
  if (target.size()>268435455 || target.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[3].IsNumber()) return LegacyPlateInputError(env);
  const double et=info[3].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(et)) return LegacyPlateInputError(env);
  if (!info[4].IsString()) return LegacyPlateInputError(env);
  const auto abcorr=info[4].As<Napi::String>().Utf8Value();
  if (abcorr.size()>268435455 || abcorr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[5].IsString()) return LegacyPlateInputError(env);
  const auto obsrvr=info[5].As<Napi::String>().Utf8Value();
  if (obsrvr.size()>268435455 || obsrvr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!LegacyPlateBuffer(info[6],napi_float64_array,3)) return LegacyPlateInputError(env);
  auto spoint=info[6].As<Napi::Float64Array>();
  for (size_t i=0;i<spoint.ElementLength();++i) if (!std::isfinite(spoint[i])) return LegacyPlateInputError(env);
  if (!LegacyPlateBuffer(info[7],napi_float64_array,3)) return LegacyPlateInputError(env);
  auto out=info[7].As<Napi::Float64Array>();
  if (!LegacyPlateBuffer(info[8],napi_int32_array,1)) return LegacyPlateInputError(env);
  auto ids=info[8].As<Napi::Int32Array>();
  char err[tspice_backend_node::kErrMaxBytes]={};
  tspice_backend_node::CspiceLock lock;
  if (tspice_illum_pl02(handle, descr, target.c_str(), et, abcorr.c_str(), obsrvr.c_str(), spoint.Data(), out.Data(), ids.Data(),err,sizeof(err))) ThrowSpiceError(env,"CSPICE failed while calling illum_pl02",err);
  return env.Undefined();
}

static Napi::Value IllumPlidPl02(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length()!=10) return LegacyPlateInputError(env);
  int32_t handle=0;
  if (!ReadInt32Checked(env,info[0],"handle",&handle)) return env.Undefined();
  int32_t descr[8]={};
  if (!ReadDlaDescriptor(env,info[1],descr)) return env.Undefined();
  if (!info[2].IsString()) return LegacyPlateInputError(env);
  const auto target=info[2].As<Napi::String>().Utf8Value();
  if (target.size()>268435455 || target.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[3].IsNumber()) return LegacyPlateInputError(env);
  const double et=info[3].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(et)) return LegacyPlateInputError(env);
  if (!info[4].IsString()) return LegacyPlateInputError(env);
  const auto abcorr=info[4].As<Napi::String>().Utf8Value();
  if (abcorr.size()>268435455 || abcorr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[5].IsString()) return LegacyPlateInputError(env);
  const auto obsrvr=info[5].As<Napi::String>().Utf8Value();
  if (obsrvr.size()>268435455 || obsrvr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!LegacyPlateBuffer(info[6],napi_float64_array,3)) return LegacyPlateInputError(env);
  auto spoint=info[6].As<Napi::Float64Array>();
  for (size_t i=0;i<spoint.ElementLength();++i) if (!std::isfinite(spoint[i])) return LegacyPlateInputError(env);
  int32_t plid=0;
  if (!ReadInt32Checked(env,info[7],"plid",&plid)) return env.Undefined();
  if (!LegacyPlateBuffer(info[8],napi_float64_array,7)) return LegacyPlateInputError(env);
  auto out=info[8].As<Napi::Float64Array>();
  if (!LegacyPlateBuffer(info[9],napi_int32_array,2)) return LegacyPlateInputError(env);
  auto ids=info[9].As<Napi::Int32Array>();
  char err[tspice_backend_node::kErrMaxBytes]={};
  tspice_backend_node::CspiceLock lock;
  if (tspice_illum_plid_pl02(handle, descr, target.c_str(), et, abcorr.c_str(), obsrvr.c_str(), spoint.Data(), plid, out.Data(), ids.Data(),err,sizeof(err))) ThrowSpiceError(env,"CSPICE failed while calling illum_plid_pl02",err);
  return env.Undefined();
}

static Napi::Value LimbPl02(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length()!=10) return LegacyPlateInputError(env);
  int32_t handle=0;
  if (!ReadInt32Checked(env,info[0],"handle",&handle)) return env.Undefined();
  int32_t descr[8]={};
  if (!ReadDlaDescriptor(env,info[1],descr)) return env.Undefined();
  if (!info[2].IsString()) return LegacyPlateInputError(env);
  const auto target=info[2].As<Napi::String>().Utf8Value();
  if (target.size()>268435455 || target.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[3].IsNumber()) return LegacyPlateInputError(env);
  const double et=info[3].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(et)) return LegacyPlateInputError(env);
  if (!info[4].IsString()) return LegacyPlateInputError(env);
  const auto fixref=info[4].As<Napi::String>().Utf8Value();
  if (fixref.size()>268435455 || fixref.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[5].IsString()) return LegacyPlateInputError(env);
  const auto abcorr=info[5].As<Napi::String>().Utf8Value();
  if (abcorr.size()>268435455 || abcorr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[6].IsString()) return LegacyPlateInputError(env);
  const auto obsrvr=info[6].As<Napi::String>().Utf8Value();
  if (obsrvr.size()>268435455 || obsrvr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  int32_t npts=0;
  if (!ReadInt32Checked(env,info[7],"npts",&npts)) return env.Undefined();
  if (npts > (268435456-32)/24) return LegacyPlateInputError(env);
  const size_t rows=npts>0 ? static_cast<size_t>(npts) : 1;
  if (!LegacyPlateBuffer(info[8],napi_float64_array,4+3*rows)) return LegacyPlateInputError(env);
  auto out=info[8].As<Napi::Float64Array>();
  if (!LegacyPlateBuffer(info[9],napi_int32_array,rows)) return LegacyPlateInputError(env);
  auto ids=info[9].As<Napi::Int32Array>();
  char err[tspice_backend_node::kErrMaxBytes]={};
  tspice_backend_node::CspiceLock lock;
  if (tspice_limb_pl02(handle, descr, target.c_str(), et, fixref.c_str(), abcorr.c_str(), obsrvr.c_str(), npts, out.Data(), ids.Data(),err,sizeof(err))) ThrowSpiceError(env,"CSPICE failed while calling limb_pl02",err);
  return env.Undefined();
}

static Napi::Value LlgridPl02(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length()!=6) return LegacyPlateInputError(env);
  int32_t handle=0;
  if (!ReadInt32Checked(env,info[0],"handle",&handle)) return env.Undefined();
  int32_t descr[8]={};
  if (!ReadDlaDescriptor(env,info[1],descr)) return env.Undefined();
  int32_t npts=0;
  if (!ReadInt32Checked(env,info[2],"npts",&npts)) return env.Undefined();
  if (npts > (268435456-32)/24) return LegacyPlateInputError(env);
  const size_t rows=npts>0 ? static_cast<size_t>(npts) : 1;
  if (!LegacyPlateBuffer(info[3],napi_float64_array,2*rows)) return LegacyPlateInputError(env);
  auto grid=info[3].As<Napi::Float64Array>();
  for (size_t i=0;i<grid.ElementLength();++i) if (!std::isfinite(grid[i])) return LegacyPlateInputError(env);
  if (!LegacyPlateBuffer(info[4],napi_float64_array,3*rows)) return LegacyPlateInputError(env);
  auto out=info[4].As<Napi::Float64Array>();
  if (!LegacyPlateBuffer(info[5],napi_int32_array,rows)) return LegacyPlateInputError(env);
  auto ids=info[5].As<Napi::Int32Array>();
  char err[tspice_backend_node::kErrMaxBytes]={};
  tspice_backend_node::CspiceLock lock;
  if (tspice_llgrid_pl02(handle, descr, npts, grid.Data(), out.Data(), ids.Data(),err,sizeof(err))) ThrowSpiceError(env,"CSPICE failed while calling llgrid_pl02",err);
  return env.Undefined();
}

static Napi::Value SubptPl02(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length()!=9) return LegacyPlateInputError(env);
  int32_t handle=0;
  if (!ReadInt32Checked(env,info[0],"handle",&handle)) return env.Undefined();
  int32_t descr[8]={};
  if (!ReadDlaDescriptor(env,info[1],descr)) return env.Undefined();
  if (!info[2].IsString()) return LegacyPlateInputError(env);
  const auto method=info[2].As<Napi::String>().Utf8Value();
  if (method.size()>268435455 || method.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[3].IsString()) return LegacyPlateInputError(env);
  const auto target=info[3].As<Napi::String>().Utf8Value();
  if (target.size()>268435455 || target.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[4].IsNumber()) return LegacyPlateInputError(env);
  const double et=info[4].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(et)) return LegacyPlateInputError(env);
  if (!info[5].IsString()) return LegacyPlateInputError(env);
  const auto abcorr=info[5].As<Napi::String>().Utf8Value();
  if (abcorr.size()>268435455 || abcorr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[6].IsString()) return LegacyPlateInputError(env);
  const auto obsrvr=info[6].As<Napi::String>().Utf8Value();
  if (obsrvr.size()>268435455 || obsrvr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!LegacyPlateBuffer(info[7],napi_float64_array,4)) return LegacyPlateInputError(env);
  auto out=info[7].As<Napi::Float64Array>();
  if (!LegacyPlateBuffer(info[8],napi_int32_array,1)) return LegacyPlateInputError(env);
  auto ids=info[8].As<Napi::Int32Array>();
  char err[tspice_backend_node::kErrMaxBytes]={};
  tspice_backend_node::CspiceLock lock;
  if (tspice_subpt_pl02(handle, descr, method.c_str(), target.c_str(), et, abcorr.c_str(), obsrvr.c_str(), out.Data(), ids.Data(),err,sizeof(err))) ThrowSpiceError(env,"CSPICE failed while calling subpt_pl02",err);
  return env.Undefined();
}

static Napi::Value SubsolPl02(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length()!=9) return LegacyPlateInputError(env);
  int32_t handle=0;
  if (!ReadInt32Checked(env,info[0],"handle",&handle)) return env.Undefined();
  int32_t descr[8]={};
  if (!ReadDlaDescriptor(env,info[1],descr)) return env.Undefined();
  if (!info[2].IsString()) return LegacyPlateInputError(env);
  const auto method=info[2].As<Napi::String>().Utf8Value();
  if (method.size()>268435455 || method.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[3].IsString()) return LegacyPlateInputError(env);
  const auto target=info[3].As<Napi::String>().Utf8Value();
  if (target.size()>268435455 || target.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[4].IsNumber()) return LegacyPlateInputError(env);
  const double et=info[4].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(et)) return LegacyPlateInputError(env);
  if (!info[5].IsString()) return LegacyPlateInputError(env);
  const auto abcorr=info[5].As<Napi::String>().Utf8Value();
  if (abcorr.size()>268435455 || abcorr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[6].IsString()) return LegacyPlateInputError(env);
  const auto obsrvr=info[6].As<Napi::String>().Utf8Value();
  if (obsrvr.size()>268435455 || obsrvr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!LegacyPlateBuffer(info[7],napi_float64_array,4)) return LegacyPlateInputError(env);
  auto out=info[7].As<Napi::Float64Array>();
  if (!LegacyPlateBuffer(info[8],napi_int32_array,1)) return LegacyPlateInputError(env);
  auto ids=info[8].As<Napi::Int32Array>();
  char err[tspice_backend_node::kErrMaxBytes]={};
  tspice_backend_node::CspiceLock lock;
  if (tspice_subsol_pl02(handle, descr, method.c_str(), target.c_str(), et, abcorr.c_str(), obsrvr.c_str(), out.Data(), ids.Data(),err,sizeof(err))) ThrowSpiceError(env,"CSPICE failed while calling subsol_pl02",err);
  return env.Undefined();
}

static Napi::Value TermPl02(const Napi::CallbackInfo& info) {
  auto env=info.Env();
  if (info.Length()!=12) return LegacyPlateInputError(env);
  int32_t handle=0;
  if (!ReadInt32Checked(env,info[0],"handle",&handle)) return env.Undefined();
  int32_t descr[8]={};
  if (!ReadDlaDescriptor(env,info[1],descr)) return env.Undefined();
  if (!info[2].IsString()) return LegacyPlateInputError(env);
  const auto trmtyp=info[2].As<Napi::String>().Utf8Value();
  if (trmtyp.size()>268435455 || trmtyp.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[3].IsString()) return LegacyPlateInputError(env);
  const auto source=info[3].As<Napi::String>().Utf8Value();
  if (source.size()>268435455 || source.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[4].IsString()) return LegacyPlateInputError(env);
  const auto target=info[4].As<Napi::String>().Utf8Value();
  if (target.size()>268435455 || target.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[5].IsNumber()) return LegacyPlateInputError(env);
  const double et=info[5].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(et)) return LegacyPlateInputError(env);
  if (!info[6].IsString()) return LegacyPlateInputError(env);
  const auto fixref=info[6].As<Napi::String>().Utf8Value();
  if (fixref.size()>268435455 || fixref.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[7].IsString()) return LegacyPlateInputError(env);
  const auto abcorr=info[7].As<Napi::String>().Utf8Value();
  if (abcorr.size()>268435455 || abcorr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  if (!info[8].IsString()) return LegacyPlateInputError(env);
  const auto obsrvr=info[8].As<Napi::String>().Utf8Value();
  if (obsrvr.size()>268435455 || obsrvr.find('\0')!=std::string::npos) return LegacyPlateInputError(env);
  int32_t npts=0;
  if (!ReadInt32Checked(env,info[9],"npts",&npts)) return env.Undefined();
  if (npts > (268435456-32)/24) return LegacyPlateInputError(env);
  const size_t rows=npts>0 ? static_cast<size_t>(npts) : 1;
  if (!LegacyPlateBuffer(info[10],napi_float64_array,4+3*rows)) return LegacyPlateInputError(env);
  auto out=info[10].As<Napi::Float64Array>();
  if (!LegacyPlateBuffer(info[11],napi_int32_array,rows)) return LegacyPlateInputError(env);
  auto ids=info[11].As<Napi::Int32Array>();
  char err[tspice_backend_node::kErrMaxBytes]={};
  tspice_backend_node::CspiceLock lock;
  if (tspice_term_pl02(handle, descr, trmtyp.c_str(), source.c_str(), target.c_str(), et, fixref.c_str(), abcorr.c_str(), obsrvr.c_str(), npts, out.Data(), ids.Data(),err,sizeof(err))) ThrowSpiceError(env,"CSPICE failed while calling term_pl02",err);
  return env.Undefined();
}

static Napi::Value Dskx02(const Napi::CallbackInfo &info) {
  Napi::Env env=info.Env();
  if (info.Length()!=4) { ThrowSpiceError(Napi::TypeError::New(env,"dskx02: invalid argument count")); return env.Undefined(); }
  int32_t handle=0, descr[8];
  if (!ReadInt32Checked(env,info[0],"handle",&handle) || !ReadDlaDescriptor(env,info[1],descr)) return env.Undefined();
  size_t nv=0,nd=0;
  if (!RayArray(env,info[2],napi_float64_array,3,&nv) ||
      !RayArray(env,info[3],napi_float64_array,3,&nd)) return env.Undefined();
  if (nv!=nd || nv!=3) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid DSK ray dimensions")); return env.Undefined(); }
  double dummy=0;
  const double *vertex=nv ? info[2].As<Napi::Float64Array>().Data() : &dummy;
  const double *dir=nd ? info[3].As<Napi::Float64Array>().Data() : &dummy;
  int plate=0,found=0;double point[3]={};
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes]={};
  if (tspice_dskx02(handle,descr,vertex,dir,&plate,point,&found,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling dskx02",err);return env.Undefined();
  }
  if (!found) return tspice_napi::MakeNotFound(env);
  auto result=tspice_napi::MakeFound<int>(env,"plid",plate);
  result.Set("xpt",tspice_napi::MakeNumberArray(env,point,3));
  return result;
}

static Napi::Value Dskxsi(const Napi::CallbackInfo &info) {
  Napi::Env env=info.Env();
  if (info.Length()!=9) { ThrowSpiceError(Napi::TypeError::New(env,"dskxsi: invalid argument count")); return env.Undefined(); }
  std::string target,fixref; size_t ns=0;
  if (!info[0].IsBoolean() || !info[3].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"Expected DSK priority and epoch")); return env.Undefined(); }
  if (!RayText(env,info[1],&target) || !RayText(env,info[4],&fixref) || !RayArray(env,info[2],napi_int32_array,67108864,&ns)) return env.Undefined();
  int sentinel=0;
  const int *surfaces=ns ? info[2].As<Napi::Int32Array>().Data() : &sentinel;
  const bool priority=info[0].As<Napi::Boolean>().Value();
  const double et=info[3].As<Napi::Number>().DoubleValue();
  size_t nv=0,nd=0;
  if (!RayArray(env,info[5],napi_float64_array,3,&nv) ||
      !RayArray(env,info[6],napi_float64_array,3,&nd)) return env.Undefined();
  if (nv!=nd || nv!=3) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid DSK ray dimensions")); return env.Undefined(); }
  double dummy=0;
  const double *vertex=nv ? info[5].As<Napi::Float64Array>().Data() : &dummy;
  const double *dir=nd ? info[6].As<Napi::Float64Array>().Data() : &dummy;
  int32_t maxd=0,maxi=0; double out[27]={};int ints[11]={};
  if (!ReadInt32Checked(env,info[7],"maxd",&maxd) || !ReadInt32Checked(env,info[8],"maxi",&maxi)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes]={};
  if (tspice_dskxsi(priority,target.c_str(),static_cast<int>(ns),surfaces,et,fixref.c_str(),vertex,dir,maxd,maxi,out,ints,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling dskxsi",err);return env.Undefined();
  }
  if (!ints[0]) return tspice_napi::MakeNotFound(env);
  auto result=tspice_napi::MakeFound<int>(env,"handle",ints[1]);
  result.Set("words",tspice_napi::MakeNumberArray(env,out,27));
  auto dla=Napi::Array::New(env,8);
  for (uint32_t i=0;i<8;++i) dla.Set(i,Napi::Number::New(env,ints[2+i]));
  result.Set("dla",dla);result.Set("plate",Napi::Number::New(env,ints[10]));
  return result;
}

static Napi::Value Dskxv(const Napi::CallbackInfo &info) {
  Napi::Env env=info.Env();
  if (info.Length()!=7) { ThrowSpiceError(Napi::TypeError::New(env,"dskxv: invalid argument count")); return env.Undefined(); }
  std::string target,fixref; size_t ns=0;
  if (!info[0].IsBoolean() || !info[3].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"Expected DSK priority and epoch")); return env.Undefined(); }
  if (!RayText(env,info[1],&target) || !RayText(env,info[4],&fixref) || !RayArray(env,info[2],napi_int32_array,67108864,&ns)) return env.Undefined();
  int sentinel=0;
  const int *surfaces=ns ? info[2].As<Napi::Int32Array>().Data() : &sentinel;
  const bool priority=info[0].As<Napi::Boolean>().Value();
  const double et=info[3].As<Napi::Number>().DoubleValue();
  size_t nv=0,nd=0;
  if (!RayArray(env,info[5],napi_float64_array,33554430,&nv) ||
      !RayArray(env,info[6],napi_float64_array,33554430,&nd)) return env.Undefined();
  if (nv!=nd || nv%3!=0) { ThrowSpiceError(Napi::RangeError::New(env,"Invalid DSK ray dimensions")); return env.Undefined(); }
  double dummy=0;
  const double *vertex=nv ? info[5].As<Napi::Float64Array>().Data() : &dummy;
  const double *dir=nd ? info[6].As<Napi::Float64Array>().Data() : &dummy;
  std::unique_ptr<double[]> out(new(std::nothrow) double[nv ? nv : 1]());
  std::unique_ptr<int[]> found(new(std::nothrow) int[nv ? nv/3 : 1]());
  if (!out || !found) { ThrowSpiceError(Napi::Error::New(env,"Unable to allocate DSK ray results")); return env.Undefined(); }
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes]={};
  if (tspice_dskxv(priority,target.c_str(),static_cast<int>(ns),surfaces,et,fixref.c_str(),static_cast<int>(nv/3),vertex,dir,out.get(),found.get(),err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling dskxv",err);return env.Undefined();
  }
  auto results=Napi::Array::New(env,nv/3);
  for (uint32_t i=0;i<nv/3;++i) {
    if (!found[i]) results.Set(i,env.Null());
    else results.Set(i,tspice_napi::MakeNumberArray(env,out.get()+3*i,3));
  }
  return results;
}

static Napi::Value Dskgtl(const Napi::CallbackInfo &info) {
  Napi::Env env=info.Env();
  if (info.Length()!=1) { ThrowSpiceError(Napi::TypeError::New(env,"dskgtl: invalid argument count")); return env.Undefined(); }
  int32_t key=0;
  if (!ReadInt32Checked(env,info[0],"key",&key)) return env.Undefined();
  double out=0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes]={};
  if (tspice_dskgtl(key,&out,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling dskgtl",err);return env.Undefined();
  }
  return Napi::Number::New(env,out);
}

static Napi::Value Dskstl(const Napi::CallbackInfo &info) {
  Napi::Env env=info.Env();
  if (info.Length()!=2) { ThrowSpiceError(Napi::TypeError::New(env,"dskstl: invalid argument count")); return env.Undefined(); }
  int32_t key=0;
  if (!ReadInt32Checked(env,info[0],"key",&key)) return env.Undefined();
  if (!info[1].IsNumber()) { ThrowSpiceError(Napi::TypeError::New(env,"Expected DSK tolerance number")); return env.Undefined(); }
  double value=info[1].As<Napi::Number>().DoubleValue();
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes]={};
  if (tspice_dskstl(key,value,err,sizeof(err))) {
    ThrowSpiceError(env,"CSPICE failed while calling dskstl",err);return env.Undefined();
  }
  return env.Undefined();
}

void RegisterDsk(Napi::Env env, Napi::Object exports) {
  SetExportChecked(env, exports, "dskd02", Napi::Function::New(env, Dskd02), "RegisterDsk");
  SetExportChecked(env, exports, "dski02", Napi::Function::New(env, Dski02), "RegisterDsk");
  SetExportChecked(env, exports, "dskn02", Napi::Function::New(env, Dskn02), "RegisterDsk");
  SetExportChecked(env, exports, "dskp02", Napi::Function::New(env, Dskp02), "RegisterDsk");
  SetExportChecked(env, exports, "dskv02", Napi::Function::New(env, Dskv02), "RegisterDsk");
  SetExportChecked(env, exports, "dskz02", Napi::Function::New(env, Dskz02), "RegisterDsk");
  SetExportChecked(env, exports, "dskcls", Napi::Function::New(env, Dskcls), "RegisterDsk");
  SetExportChecked(env, exports, "dskobj", Napi::Function::New(env, Dskobj), "RegisterDsk");
  SetExportChecked(env, exports, "dsksrf", Napi::Function::New(env, Dsksrf), "RegisterDsk");
  if (!SetExportChecked(env,exports,"illum_pl02",Napi::Function::New(env,IllumPl02),"RegisterDsk")) return;
  if (!SetExportChecked(env,exports,"illum_plid_pl02",Napi::Function::New(env,IllumPlidPl02),"RegisterDsk")) return;
  if (!SetExportChecked(env,exports,"limb_pl02",Napi::Function::New(env,LimbPl02),"RegisterDsk")) return;
  if (!SetExportChecked(env,exports,"llgrid_pl02",Napi::Function::New(env,LlgridPl02),"RegisterDsk")) return;
  if (!SetExportChecked(env,exports,"subpt_pl02",Napi::Function::New(env,SubptPl02),"RegisterDsk")) return;
  if (!SetExportChecked(env,exports,"subsol_pl02",Napi::Function::New(env,SubsolPl02),"RegisterDsk")) return;
  if (!SetExportChecked(env,exports,"term_pl02",Napi::Function::New(env,TermPl02),"RegisterDsk")) return;
  if (!SetExportChecked(env,exports,"dskx02",Napi::Function::New(env,Dskx02),"RegisterDsk")) return;
  if (!SetExportChecked(env,exports,"dskxsi",Napi::Function::New(env,Dskxsi),"RegisterDsk")) return;
  if (!SetExportChecked(env,exports,"dskxv",Napi::Function::New(env,Dskxv),"RegisterDsk")) return;
  if (!SetExportChecked(env,exports,"dskgtl",Napi::Function::New(env,Dskgtl),"RegisterDsk")) return;
  if (!SetExportChecked(env,exports,"dskstl",Napi::Function::New(env,Dskstl),"RegisterDsk")) return;
  SetExportChecked(env, exports, "dskgd", Napi::Function::New(env, Dskgd), "RegisterDsk");
  SetExportChecked(env, exports, "dskb02", Napi::Function::New(env, Dskb02), "RegisterDsk");
}

}  // namespace tspice_backend_node
