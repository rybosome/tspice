#include "file_io.h"

#include <string>
#include <cmath>
#include <cstdint>
#include <limits>
#include <vector>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNotFound;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;
using tspice_napi::FixedWidthToJsString;

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
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + label + " to be a 32-bit signed integer"));
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

static Napi::Object MakeDlaDescriptor(Napi::Env env, const int32_t descr8[8]) {
  Napi::Object descr = Napi::Object::New(env);
  descr.Set("bwdptr", Napi::Number::New(env, (double)descr8[0]));
  descr.Set("fwdptr", Napi::Number::New(env, (double)descr8[1]));
  descr.Set("ibase", Napi::Number::New(env, (double)descr8[2]));
  descr.Set("isize", Napi::Number::New(env, (double)descr8[3]));
  descr.Set("dbase", Napi::Number::New(env, (double)descr8[4]));
  descr.Set("dsize", Napi::Number::New(env, (double)descr8[5]));
  descr.Set("cbase", Napi::Number::New(env, (double)descr8[6]));
  descr.Set("csize", Napi::Number::New(env, (double)descr8[7]));
  return descr;
}

static Napi::Boolean Exists(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "exists(path: string) expects exactly one string argument"));
    return Napi::Boolean::New(env, false);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int exists = 0;
  const int code = tspice_exists(path.c_str(), &exists, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling exists(\"") + path + "\")", err);
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, exists != 0);
}

static Napi::Object Getfat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "getfat(path: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char arch[tspice_backend_node::kOutMaxBytes];
  char type[tspice_backend_node::kOutMaxBytes];

  const int code = tspice_getfat(
      path.c_str(),
      arch,
      (int)sizeof(arch),
      type,
      (int)sizeof(type),
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling getfat(\"") + path + "\")", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("arch", FixedWidthToJsString(env, arch, sizeof(arch)));
  result.Set("type", FixedWidthToJsString(env, type, sizeof(type)));
  return result;
}

static Napi::Number Dafopr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dafopr(path: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_dafopr(path.c_str(), &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dafopr(\"") + path + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static void Dafcls(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "dafcls(handle: number) expects exactly one numeric handle"));
    return;
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_dafcls(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dafcls(handle=") + std::to_string(handle) + ")", err);
  }
}

static void Dafbfs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "dafbfs(handle: number) expects exactly one numeric handle"));
    return;
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_dafbfs(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dafbfs(handle=") + std::to_string(handle) + ")", err);
  }
}

static Napi::Boolean Daffna(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "daffna(handle: number) expects exactly one numeric handle"));
    return Napi::Boolean::New(env, false);
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return Napi::Boolean::New(env, false);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int found = 0;
  const int code = tspice_daffna(handle, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling daffna(handle=") + std::to_string(handle) + ")", err);
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, found != 0);
}

static Napi::Number Dasopr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dasopr(path: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_dasopr(path.c_str(), &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dasopr(\"") + path + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static void Dascls(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "dascls(handle: number) expects exactly one numeric handle"));
    return;
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_dascls(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dascls(handle=") + std::to_string(handle) + ")", err);
  }
}

static void Dlacls(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "dlacls(handle: number) expects exactly one numeric handle"));
    return;
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_dlacls(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dlacls(handle=") + std::to_string(handle) + ")", err);
  }
}

static Napi::Number Dlaopn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 4 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString() || !info[3].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "dlaopn(path: string, ftype: string, ifname: string, ncomch: number) expects 3 strings + 1 number"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();
  const std::string ftype = info[1].As<Napi::String>().Utf8Value();
  const std::string ifname = info[2].As<Napi::String>().Utf8Value();
  int32_t ncomch = 0;
  if (!ReadInt32Checked(env, info[3], "ncomch", &ncomch)) {
    return Napi::Number::New(env, 0);
  }
  if (ncomch < 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected ncomch to be a non-negative 32-bit signed integer"));
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_dlaopn(
      path.c_str(),
      ftype.c_str(),
      ifname.c_str(),
      ncomch,
      &handle,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dlaopn(\"") + path + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static Napi::Number Dskopn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "dskopn(path: string, ifname: string, ncomch: number) expects 2 strings + 1 number"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();
  const std::string ifname = info[1].As<Napi::String>().Utf8Value();
  int32_t ncomch = 0;
  if (!ReadInt32Checked(env, info[2], "ncomch", &ncomch)) {
    return Napi::Number::New(env, 0);
  }
  if (ncomch < 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected ncomch to be a non-negative 32-bit signed integer"));
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_dskopn(
      path.c_str(),
      ifname.c_str(),
      ncomch,
      &handle,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dskopn(\"") + path + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static Napi::Object Dskmi2(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 11 || !info[1].IsArray() || !info[3].IsArray() || !info[4].IsNumber() || !info[5].IsNumber() ||
      !info[9].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "dskmi2(nv, vrtces, np, plates, finscl, corscl, worksz, voxpsz, voxlsz, makvtl, spxisz) expects 11 args"));
    return Napi::Object::New(env);
  }

  int32_t nv = 0;
  if (!ReadInt32Checked(env, info[0], "nv", &nv)) {
    return Napi::Object::New(env);
  }
  if (nv < 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected nv to be a non-negative 32-bit signed integer"));
    return Napi::Object::New(env);
  }

  int32_t np = 0;
  if (!ReadInt32Checked(env, info[2], "np", &np)) {
    return Napi::Object::New(env);
  }
  if (np < 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected np to be a non-negative 32-bit signed integer"));
    return Napi::Object::New(env);
  }

  const uint64_t expectedVrtcesLen64 = (uint64_t)(uint32_t)nv * 3u;
  const uint64_t expectedPlatesLen64 = (uint64_t)(uint32_t)np * 3u;

  if (expectedVrtcesLen64 > std::numeric_limits<uint32_t>::max()) {
    ThrowSpiceError(Napi::RangeError::New(env, "nv is too large (nv*3 exceeds uint32)"));
    return Napi::Object::New(env);
  }
  if (expectedPlatesLen64 > std::numeric_limits<uint32_t>::max()) {
    ThrowSpiceError(Napi::RangeError::New(env, "np is too large (np*3 exceeds uint32)"));
    return Napi::Object::New(env);
  }

  const uint32_t expectedVrtcesLen = (uint32_t)expectedVrtcesLen64;
  const uint32_t expectedPlatesLen = (uint32_t)expectedPlatesLen64;

  std::vector<double> vrtces;
  vrtces.resize(expectedVrtcesLen);
  {
    Napi::Array arr = info[1].As<Napi::Array>();
    if (arr.Length() != expectedVrtcesLen) {
      ThrowSpiceError(Napi::TypeError::New(
          env,
          std::string("vrtces must have length ") + std::to_string(expectedVrtcesLen)));
      return Napi::Object::New(env);
    }
    for (uint32_t i = 0; i < expectedVrtcesLen; i++) {
      const Napi::Value v = arr.Get(i);
      if (!v.IsNumber()) {
        ThrowSpiceError(Napi::TypeError::New(env, "vrtces must contain only numbers"));
        return Napi::Object::New(env);
      }
      vrtces[i] = v.As<Napi::Number>().DoubleValue();
    }
  }

  std::vector<int32_t> plates;
  plates.resize(expectedPlatesLen);
  {
    Napi::Array arr = info[3].As<Napi::Array>();
    if (arr.Length() != expectedPlatesLen) {
      ThrowSpiceError(Napi::TypeError::New(
          env,
          std::string("plates must have length ") + std::to_string(expectedPlatesLen)));
      return Napi::Object::New(env);
    }
    for (uint32_t i = 0; i < expectedPlatesLen; i++) {
      int32_t v = 0;
      if (!ReadInt32Checked(env, arr.Get(i), "plates[]", &v)) {
        return Napi::Object::New(env);
      }
      if (v < 1 || v > nv) {
        ThrowSpiceError(Napi::RangeError::New(
            env,
            std::string("plates[") + std::to_string(i) + "] must be in [1, nv]"));
        return Napi::Object::New(env);
      }
      plates[i] = v;
    }
  }

  const double finscl = info[4].As<Napi::Number>().DoubleValue();

  int32_t corscl = 0;
  if (!ReadInt32Checked(env, info[5], "corscl", &corscl)) {
    return Napi::Object::New(env);
  }

  static constexpr int32_t kMaxDskmi2Size = 5000000;

  int32_t worksz = 0;
  if (!ReadInt32Checked(env, info[6], "worksz", &worksz)) {
    return Napi::Object::New(env);
  }
  if (worksz <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "Expected worksz to be a positive 32-bit signed integer"));
    return Napi::Object::New(env);
  }
  if (worksz > kMaxDskmi2Size) {
    ThrowSpiceError(Napi::RangeError::New(env, "Expected worksz to be <= 5000000"));
    return Napi::Object::New(env);
  }

  int32_t voxpsz = 0;
  if (!ReadInt32Checked(env, info[7], "voxpsz", &voxpsz)) {
    return Napi::Object::New(env);
  }
  if (voxpsz < 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected voxpsz to be a non-negative 32-bit signed integer"));
    return Napi::Object::New(env);
  }

  int32_t voxlsz = 0;
  if (!ReadInt32Checked(env, info[8], "voxlsz", &voxlsz)) {
    return Napi::Object::New(env);
  }
  if (voxlsz < 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected voxlsz to be a non-negative 32-bit signed integer"));
    return Napi::Object::New(env);
  }

  const bool makvtl = info[9].As<Napi::Boolean>().Value();

  int32_t spxisz = 0;
  if (!ReadInt32Checked(env, info[10], "spxisz", &spxisz)) {
    return Napi::Object::New(env);
  }
  if (spxisz <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "Expected spxisz to be a positive 32-bit signed integer"));
    return Napi::Object::New(env);
  }
  if (spxisz > kMaxDskmi2Size) {
    ThrowSpiceError(Napi::RangeError::New(env, "Expected spxisz to be <= 5000000"));
    return Napi::Object::New(env);
  }

  static constexpr int kSpaixdSize = 10;  // SPICE_DSK02_IXDFIX
  std::vector<double> spaixd;
  spaixd.resize(kSpaixdSize);
  std::vector<int32_t> spaixi;
  spaixi.resize((size_t)spxisz);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];

  const int code = tspice_dskmi2(
      nv,
      vrtces.data(),
      np,
      plates.data(),
      finscl,
      corscl,
      worksz,
      voxpsz,
      voxlsz,
      makvtl ? 1 : 0,
      spxisz,
      spaixd.data(),
      kSpaixdSize,
      spaixi.data(),
      spxisz,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dskmi2", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);

  Napi::Array outSpaixd = Napi::Array::New(env, spaixd.size());
  for (uint32_t i = 0; i < spaixd.size(); i++) {
    outSpaixd.Set(i, Napi::Number::New(env, spaixd[i]));
  }
  result.Set("spaixd", outSpaixd);

  Napi::Array outSpaixi = Napi::Array::New(env, spaixi.size());
  for (uint32_t i = 0; i < spaixi.size(); i++) {
    outSpaixi.Set(i, Napi::Number::New(env, (double)spaixi[i]));
  }
  result.Set("spaixi", outSpaixi);

  return result;
}

static void Dskw02(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 21 || !info[4].IsString() || !info[6].IsArray() ||
      !info[7].IsNumber() || !info[8].IsNumber() || !info[9].IsNumber() || !info[10].IsNumber() ||
      !info[11].IsNumber() || !info[12].IsNumber() || !info[13].IsNumber() || !info[14].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "dskw02(handle, center, surfid, dclass, frame, corsys, corpar, mncor1, mxcor1, mncor2, mxcor2, mncor3, mxcor3, first, last, nv, vrtces, np, plates, spaixd, spaixi) expects 21 args"));
    return;
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return;
  }
  int32_t center = 0;
  if (!ReadInt32Checked(env, info[1], "center", &center)) {
    return;
  }
  int32_t surfid = 0;
  if (!ReadInt32Checked(env, info[2], "surfid", &surfid)) {
    return;
  }
  int32_t dclass = 0;
  if (!ReadInt32Checked(env, info[3], "dclass", &dclass)) {
    return;
  }

  const std::string frame = info[4].As<Napi::String>().Utf8Value();

  int32_t corsys = 0;
  if (!ReadInt32Checked(env, info[5], "corsys", &corsys)) {
    return;
  }

  double corpar[10] = {0};
  if (!tspice_backend_node::ReadNumberArrayFixed(env, info[6], 10, corpar, "corpar")) {
    return;
  }

  const double mncor1 = info[7].As<Napi::Number>().DoubleValue();
  const double mxcor1 = info[8].As<Napi::Number>().DoubleValue();
  const double mncor2 = info[9].As<Napi::Number>().DoubleValue();
  const double mxcor2 = info[10].As<Napi::Number>().DoubleValue();
  const double mncor3 = info[11].As<Napi::Number>().DoubleValue();
  const double mxcor3 = info[12].As<Napi::Number>().DoubleValue();
  const double first = info[13].As<Napi::Number>().DoubleValue();
  const double last = info[14].As<Napi::Number>().DoubleValue();

  int32_t nv = 0;
  if (!ReadInt32Checked(env, info[15], "nv", &nv)) {
    return;
  }
  if (nv < 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected nv to be a non-negative 32-bit signed integer"));
    return;
  }

  int32_t np = 0;
  if (!ReadInt32Checked(env, info[17], "np", &np)) {
    return;
  }
  if (np < 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected np to be a non-negative 32-bit signed integer"));
    return;
  }

  const uint64_t expectedVrtcesLen64 = (uint64_t)(uint32_t)nv * 3u;
  const uint64_t expectedPlatesLen64 = (uint64_t)(uint32_t)np * 3u;

  if (expectedVrtcesLen64 > std::numeric_limits<uint32_t>::max()) {
    ThrowSpiceError(Napi::RangeError::New(env, "nv is too large (nv*3 exceeds uint32)"));
    return;
  }
  if (expectedPlatesLen64 > std::numeric_limits<uint32_t>::max()) {
    ThrowSpiceError(Napi::RangeError::New(env, "np is too large (np*3 exceeds uint32)"));
    return;
  }

  const uint32_t expectedVrtcesLen = (uint32_t)expectedVrtcesLen64;
  const uint32_t expectedPlatesLen = (uint32_t)expectedPlatesLen64;

  std::vector<double> vrtces;
  vrtces.resize(expectedVrtcesLen);
  {
    if (!info[16].IsArray()) {
      ThrowSpiceError(Napi::TypeError::New(env, "vrtces must be an array"));
      return;
    }
    Napi::Array arr = info[16].As<Napi::Array>();
    if (arr.Length() != expectedVrtcesLen) {
      ThrowSpiceError(Napi::TypeError::New(
          env,
          std::string("vrtces must have length ") + std::to_string(expectedVrtcesLen)));
      return;
    }
    for (uint32_t i = 0; i < expectedVrtcesLen; i++) {
      const Napi::Value v = arr.Get(i);
      if (!v.IsNumber()) {
        ThrowSpiceError(Napi::TypeError::New(env, "vrtces must contain only numbers"));
        return;
      }
      vrtces[i] = v.As<Napi::Number>().DoubleValue();
    }
  }

  std::vector<int32_t> plates;
  plates.resize(expectedPlatesLen);
  {
    if (!info[18].IsArray()) {
      ThrowSpiceError(Napi::TypeError::New(env, "plates must be an array"));
      return;
    }
    Napi::Array arr = info[18].As<Napi::Array>();
    if (arr.Length() != expectedPlatesLen) {
      ThrowSpiceError(Napi::TypeError::New(
          env,
          std::string("plates must have length ") + std::to_string(expectedPlatesLen)));
      return;
    }
    for (uint32_t i = 0; i < expectedPlatesLen; i++) {
      int32_t v = 0;
      if (!ReadInt32Checked(env, arr.Get(i), "plates[]", &v)) {
        return;
      }
      if (v < 1 || v > nv) {
        ThrowSpiceError(Napi::RangeError::New(
            env,
            std::string("plates[") + std::to_string(i) + "] must be in [1, nv]"));
        return;
      }
      plates[i] = v;
    }
  }

  static constexpr uint32_t kSpaixdSize = 10;  // SPICE_DSK02_IXDFIX
  std::vector<double> spaixd;
  spaixd.resize(kSpaixdSize);
  {
    if (!info[19].IsArray()) {
      ThrowSpiceError(Napi::TypeError::New(env, "spaixd must be an array"));
      return;
    }
    Napi::Array arr = info[19].As<Napi::Array>();
    if (arr.Length() != kSpaixdSize) {
      ThrowSpiceError(Napi::TypeError::New(
          env,
          std::string("spaixd must have length ") + std::to_string(kSpaixdSize)));
      return;
    }
    for (uint32_t i = 0; i < kSpaixdSize; i++) {
      const Napi::Value v = arr.Get(i);
      if (!v.IsNumber()) {
        ThrowSpiceError(Napi::TypeError::New(env, "spaixd must contain only numbers"));
        return;
      }
      spaixd[i] = v.As<Napi::Number>().DoubleValue();
    }
  }

  std::vector<int32_t> spaixi;
  int32_t spaixiLen = 0;
  {
    if (!info[20].IsArray()) {
      ThrowSpiceError(Napi::TypeError::New(env, "spaixi must be an array"));
      return;
    }
    Napi::Array arr = info[20].As<Napi::Array>();
    const uint32_t len = arr.Length();
    if (len > (uint32_t)std::numeric_limits<int32_t>::max()) {
      ThrowSpiceError(Napi::RangeError::New(env, "spaixi is too large"));
      return;
    }
    spaixiLen = (int32_t)len;
    spaixi.resize(len);
    for (uint32_t i = 0; i < len; i++) {
      int32_t v = 0;
      if (!ReadInt32Checked(env, arr.Get(i), "spaixi[]", &v)) {
        return;
      }
      spaixi[i] = v;
    }
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];

  const int code = tspice_dskw02(
      handle,
      center,
      surfid,
      dclass,
      frame.c_str(),
      corsys,
      corpar,
      mncor1,
      mxcor1,
      mncor2,
      mxcor2,
      mncor3,
      mxcor3,
      first,
      last,
      nv,
      vrtces.data(),
      np,
      plates.data(),
      spaixd.data(),
      (int)kSpaixdSize,
      spaixi.data(),
      spaixiLen,
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dskw02", err);
  }
}

static Napi::Object Dlabfs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "dlabfs(handle: number) expects exactly one numeric handle"));
    return Napi::Object::New(env);
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int32_t descr8[8] = {0};
  int32_t found = 0;
  const int code = tspice_dlabfs(handle, descr8, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dlabfs(handle=") + std::to_string(handle) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("descr", MakeDlaDescriptor(env, descr8));
  return result;
}

static Napi::Object Dlafns(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "dlafns(handle: number, descr: object) expects a handle and descriptor"));
    return Napi::Object::New(env);
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return Napi::Object::New(env);
  }
  int32_t descr8[8] = {0};
  if (!ReadDlaDescriptor(env, info[1], descr8)) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int32_t nextDescr8[8] = {0};
  int32_t found = 0;
  const int code = tspice_dlafns(handle, descr8, nextDescr8, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dlafns(handle=") + std::to_string(handle) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("descr", MakeDlaDescriptor(env, nextDescr8));
  return result;
}

namespace tspice_backend_node {

void RegisterFileIo(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "exists", Napi::Function::New(env, Exists), __func__)) return;
  if (!SetExportChecked(env, exports, "getfat", Napi::Function::New(env, Getfat), __func__)) return;

  if (!SetExportChecked(env, exports, "dafopr", Napi::Function::New(env, Dafopr), __func__)) return;
  if (!SetExportChecked(env, exports, "dafcls", Napi::Function::New(env, Dafcls), __func__)) return;
  if (!SetExportChecked(env, exports, "dafbfs", Napi::Function::New(env, Dafbfs), __func__)) return;
  if (!SetExportChecked(env, exports, "daffna", Napi::Function::New(env, Daffna), __func__)) return;

  if (!SetExportChecked(env, exports, "dasopr", Napi::Function::New(env, Dasopr), __func__)) return;
  if (!SetExportChecked(env, exports, "dascls", Napi::Function::New(env, Dascls), __func__)) return;

  if (!SetExportChecked(env, exports, "dlacls", Napi::Function::New(env, Dlacls), __func__)) return;

  if (!SetExportChecked(env, exports, "dlaopn", Napi::Function::New(env, Dlaopn), __func__)) return;
  if (!SetExportChecked(env, exports, "dlabfs", Napi::Function::New(env, Dlabfs), __func__)) return;
  if (!SetExportChecked(env, exports, "dlafns", Napi::Function::New(env, Dlafns), __func__)) return;

  if (!SetExportChecked(env, exports, "dskopn", Napi::Function::New(env, Dskopn), __func__)) return;
  if (!SetExportChecked(env, exports, "dskmi2", Napi::Function::New(env, Dskmi2), __func__)) return;
  if (!SetExportChecked(env, exports, "dskw02", Napi::Function::New(env, Dskw02), __func__)) return;
}

}  // namespace tspice_backend_node
