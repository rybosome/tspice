#include "file_io.h"

#include <string>
#include <algorithm>
#include <cstring>
#include <cmath>
#include <cstdint>
#include <limits>
#include <vector>
#include <memory>
#include <new>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNotFound;
using tspice_napi::PreviewForError;
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
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling exists(\"") + PreviewForError(path) + "\")",
        err);
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
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling getfat(\"") + PreviewForError(path) + "\")",
        err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("arch", FixedWidthToJsString(env, arch, sizeof(arch)));
  result.Set("type", FixedWidthToJsString(env, type, sizeof(type)));
  return result;
}

static bool DafArgs(const Napi::CallbackInfo& info, size_t count) {
  if (info.Length() == count) return true;
  ThrowSpiceError(Napi::TypeError::New(info.Env(), "Incorrect DAF argument count"));
  return false;
}

static bool DafSuccess(Napi::Env env, int status, const char* op, const char* err) {
  if (status == 0) return true;
  ThrowSpiceError(env, std::string("CSPICE failed while calling ") + op, err);
  return false;
}

static Napi::Uint8Array DafBytes(Napi::Env env, const void *ptr, size_t length) {
  auto result = Napi::Uint8Array::New(env, length);
  if (length)
    std::memcpy(result.Data(), ptr, length);
  return result;
}

static bool DafCounts(const Napi::CallbackInfo &info, size_t index, int32_t &nd, int32_t &ni,
                      int &n, int &m) {
  if (!ReadInt32Checked(info.Env(), info[index], "nd", &nd) ||
      !ReadInt32Checked(info.Env(), info[index + 1], "ni", &ni))
    return false;
  n = std::clamp<int>(nd, 0, 125);
  m = std::clamp<int>(ni, 0, 250 - 2 * n);
  return true;
}

static bool DafInputBytes(Napi::Env env, const Napi::Value &value, int limit, Napi::Uint8Array *view) {
  if (!value.IsTypedArray() || value.As<Napi::TypedArray>().TypedArrayType() != napi_uint8_array ||
      value.As<Napi::Uint8Array>().ByteLength() > static_cast<size_t>(limit)) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected bounded Uint8Array DAF storage"));
    return false;
  }
  *view = value.As<Napi::Uint8Array>();
  return true;
}

static Napi::Value Dafac(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  int32_t handle = 0, rows = 0, width = 0;
  Napi::Uint8Array view;
  if (!DafArgs(info, 4) || !ReadInt32Checked(env, info[0], "handle", &handle) ||
      !ReadInt32Checked(env, info[1], "rows", &rows) || !ReadInt32Checked(env, info[2], "width", &width) ||
      !DafInputBytes(env, info[3], TSPICE_DAF_PAGE_BYTES, &view))
    return env.Undefined();
  unsigned char sentinel = 0;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  // JS has already produced a private fixed-row table. Take a native snapshot
  // so a direct addon caller with shared backing storage cannot change a row.
  const size_t length = view.ByteLength();
  if (rows < 0 || width < 2 || static_cast<int64_t>(rows) * width > static_cast<int64_t>(length)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid DAF input row table"));
    return env.Undefined();
  }
  std::unique_ptr<unsigned char[]> data(length ? new (std::nothrow) unsigned char[length] : nullptr);
  if (length && !data) {
    ThrowSpiceError(Napi::Error::New(env, "Cannot allocate DAF input storage"));
    return env.Undefined();
  }
  if (length)
    std::memcpy(data.get(), view.Data(), length);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  DafSuccess(env,
             tspice_dafac(handle, rows, width, length ? data.get() : &sentinel, static_cast<int>(length), err,
                          sizeof(err)),
             "dafac", err);
  return env.Undefined();
}

static Napi::Value Dafdc(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  int32_t handle = 0;
  if (!DafArgs(info, 1) || !ReadInt32Checked(env, info[0], "handle", &handle))
    return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  DafSuccess(env, tspice_dafdc(handle, err, sizeof(err)), "dafdc", err);
  return env.Undefined();
}

static Napi::Value Dafec(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  int32_t handle = 0, rows = 0, width = 0;
  if (!DafArgs(info, 3) || !ReadInt32Checked(env, info[0], "handle", &handle) ||
      !ReadInt32Checked(env, info[1], "bufsiz", &rows) || !ReadInt32Checked(env, info[2], "buffln", &width))
    return env.Undefined();
  const int64_t size = rows > 0 && width >= 2 ? static_cast<int64_t>(rows) * width : 1;
  if (size > TSPICE_DAF_PAGE_BYTES) {
    ThrowSpiceError(Napi::RangeError::New(env, "DAF comment page exceeds 256 MiB"));
    return env.Undefined();
  }
  std::unique_ptr<unsigned char[]> data(new (std::nothrow) unsigned char[size]);
  if (!data) {
    ThrowSpiceError(Napi::Error::New(env, "Cannot allocate DAF output storage"));
    return env.Undefined();
  }
  int n = 0, done = 0;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (!DafSuccess(
          env,
          tspice_dafec(handle, rows, width, data.get(), static_cast<int>(size), &n, &done, err, sizeof(err)),
          "dafec", err))
    return env.Undefined();
  auto result = Napi::Object::New(env);
  result.Set("n", n);
  result.Set("done", done != 0);
  result.Set("bytes", DafBytes(env, data.get(), static_cast<size_t>(n) * width));
  return result;
}

static Napi::Value Dafrs(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  int32_t handle = 0;
  Napi::Uint8Array view;
  if (!DafArgs(info, 2) || !ReadInt32Checked(env, info[0], "handle", &handle) ||
      !DafInputBytes(env, info[1], TSPICE_DAF_SUMMARY_BYTES, &view))
    return env.Undefined();
  unsigned char bytes[TSPICE_DAF_SUMMARY_BYTES] = {};
  const size_t n = view.ByteLength();
  if (n)
    std::memcpy(bytes, view.Data(), n);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  DafSuccess(env, tspice_dafrs(handle, bytes, static_cast<int>(n), err, sizeof(err)), "dafrs", err);
  return env.Undefined();
}

static Napi::Value Dafps(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  int32_t nd = 0, ni = 0;
  int n = 0, m = 0;
  if (!DafArgs(info, 4) || !DafCounts(info, 0, nd, ni, n, m))
    return env.Undefined();
  if (!info[2].IsArray() || !info[3].IsArray() ||
      info[2].As<Napi::Array>().Length() < static_cast<unsigned>(n) ||
      info[3].As<Napi::Array>().Length() < static_cast<unsigned>(m)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Insufficient DAFPS component storage"));
    return env.Undefined();
  }
  double dc[125] = {};
  int32_t ic[250] = {};
  unsigned char out[1000] = {};
  const auto doubles = info[2].As<Napi::Array>(), integers = info[3].As<Napi::Array>();
  for (int i = 0; i < n; ++i) {
    auto value = doubles.Get(i);
    if (!value.IsNumber()) {
      ThrowSpiceError(Napi::TypeError::New(env, "DAFPS double components must be numbers"));
      return env.Undefined();
    }
    dc[i] = value.As<Napi::Number>().DoubleValue();
  }
  for (int i = 0; i < m; ++i)
    if (!ReadInt32Checked(env, integers.Get(i), "DAFPS integer component", &ic[i]))
      return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (!DafSuccess(env, tspice_dafps(nd, ni, dc, n, ic, m, out, sizeof(out), err, sizeof(err)),
                  "dafps", err))
    return env.Undefined();
  return DafBytes(env, out, 8 * (n + (m + 1) / 2));
}

static Napi::Value Dafus(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  int32_t nd = 0, ni = 0;
  int n = 0, m = 0;
  if (!DafArgs(info, 3) || !DafCounts(info, 1, nd, ni, n, m))
    return env.Undefined();
  const int size = 8 * (n + (m + 1) / 2);
  if (!info[0].IsTypedArray() ||
      info[0].As<Napi::TypedArray>().TypedArrayType() != napi_uint8_array ||
      info[0].As<Napi::Uint8Array>().ByteLength() < static_cast<size_t>(size)) {
    ThrowSpiceError(Napi::TypeError::New(env, "DAFUS requires sufficient packed bytes"));
    return env.Undefined();
  }
  unsigned char summary[1000] = {};
  double dc[125] = {};
  int ic[250] = {};
  if (size)
    std::memcpy(summary, info[0].As<Napi::Uint8Array>().Data(), size);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (!DafSuccess(env, tspice_dafus(summary, size, nd, ni, dc, n, ic, m, err, sizeof(err)), "dafus",
                  err))
    return env.Undefined();
  auto result = Napi::Object::New(env);
  auto integers = Napi::Array::New(env, m);
  for (int i = 0; i < m; ++i)
    integers.Set(static_cast<uint32_t>(i), Napi::Number::New(env, ic[i]));
  result.Set("dc", tspice_napi::MakeNumberArray(env, dc, n));
  result.Set("ic", integers);
  return result;
}

static Napi::Value Dafgsr(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  int32_t handle = 0, recno = 0, begin = 0, end = 0;
  if (!DafArgs(info, 4) || !ReadInt32Checked(env, info[0], "handle", &handle) ||
      !ReadInt32Checked(env, info[1], "recno", &recno) ||
      !ReadInt32Checked(env, info[2], "begin", &begin) ||
      !ReadInt32Checked(env, info[3], "end", &end))
    return env.Undefined();
  unsigned char data[1024] = {};
  int found = 0;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (!DafSuccess(
          env,
          tspice_dafgsr(handle, recno, begin, end, data, sizeof(data), &found, err, sizeof(err)),
          "dafgsr", err))
    return env.Undefined();
  if (!found)
    return MakeNotFound(env);
  const int first = std::max(1, begin), last = std::min(128, end);
  const auto bytes = first > last ? 0 : 8 * (last - first + 1);
  auto result = Napi::Object::New(env);
  result.Set("found", true);
  result.Set("data", DafBytes(env, data, bytes));
  return result;
}

static Napi::Value Dafrfr(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  int32_t handle = 0, len = 0;
  if (!DafArgs(info, 2) || !ReadInt32Checked(env, info[0], "handle", &handle) ||
      !ReadInt32Checked(env, info[1], "ifnlen", &len))
    return env.Undefined();
  char name[61] = {};
  int values[5] = {};
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (!DafSuccess(env, tspice_dafrfr(handle, len, name, sizeof(name), values, err, sizeof(err)),
                  "dafrfr", err))
    return env.Undefined();
  const char *keys[] = {"nd", "ni", "fward", "bward", "free"};
  auto result = Napi::Object::New(env);
  for (size_t i = 0; i < 5; ++i)
    result.Set(keys[i], Napi::Number::New(env, values[i]));
  result.Set("ifname", DafBytes(env, name, std::strlen(name)));
  return result;
}

static bool DafAddressArgs(const Napi::CallbackInfo &info, int32_t &handle, int32_t &begin,
                           int32_t &end, int &words) {
  auto env = info.Env();
  if (!DafArgs(info, 3) || !ReadInt32Checked(env, info[0], "handle", &handle) ||
      !ReadInt32Checked(env, info[1], "begin", &begin) ||
      !ReadInt32Checked(env, info[2], "end", &end))
    return false;
  words = 0;
  if (begin > 0 && end >= begin) {
    if ((int64_t)end - begin + 1 > 33554432 ||
        (int64_t)((end - 1) / 128) * 1024 > std::numeric_limits<long>::max()) {
      ThrowSpiceError(Napi::RangeError::New(
          env, "DAF address range exceeds the supported output or seek limit"));
      return false;
    }
    words = end - begin + 1;
  }
  return true;
}
static Napi::Value Dafrda(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  int32_t handle = 0, begin = 0, end = 0;
  int words = 0;
  if (!DafAddressArgs(info, handle, begin, end, words))
    return env.Undefined();
  auto storage = Napi::Float64Array::New(env, std::max(1, words));
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (!DafSuccess(env, tspice_dafrda(handle, begin, end, storage.Data(), words, err, sizeof(err)),
                  "dafrda", err))
    return env.Undefined();
  return Napi::Uint8Array::New(env, static_cast<size_t>(words) * 8, storage.ArrayBuffer(), 0);
}

static Napi::Value Dafgda(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  int32_t handle = 0, begin = 0, end = 0;
  int words = 0;
  if (!DafAddressArgs(info, handle, begin, end, words))
    return env.Undefined();
  auto storage = Napi::Float64Array::New(env, std::max(1, words));
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (!DafSuccess(env, tspice_dafgda(handle, begin, end, storage.Data(), words, err, sizeof(err)),
                  "dafgda", err))
    return env.Undefined();
  return tspice_napi::MakeNumberArray(env, storage.Data(), words);
}

static Napi::Value Dafbbs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!DafArgs(info, 1)) return env.Undefined();
  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "DAF handle", &handle)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (!DafSuccess(env, tspice_dafbbs(handle, err, sizeof(err)), "dafbbs", err)) return env.Undefined();
  return env.Undefined();
}

static Napi::Value Dafcs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!DafArgs(info, 1)) return env.Undefined();
  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "DAF handle", &handle)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (!DafSuccess(env, tspice_dafcs(handle, err, sizeof(err)), "dafcs", err)) return env.Undefined();
  return env.Undefined();
}

static Napi::Value Daffpa(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!DafArgs(info, 1)) return env.Undefined();
  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "DAF handle", &handle)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int found = 0;
  if (!DafSuccess(env, tspice_daffpa(handle, &found, err, sizeof(err)), "daffpa", err)) return env.Undefined();
  return Napi::Boolean::New(env, found != 0);
}

static Napi::Value Dafgh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!DafArgs(info, 0)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int handle = 0;
  if (!DafSuccess(env, tspice_dafgh(&handle, err, sizeof(err)), "dafgh", err)) return env.Undefined();
  return Napi::Number::New(env, handle);
}

static Napi::Value Dafgn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!DafArgs(info, 2)) return env.Undefined();
  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "DAF handle", &handle)) return env.Undefined();
  int32_t namlen = 0;
  if (!ReadInt32Checked(env, info[1], "namlen", &namlen)) return env.Undefined();
  namlen = std::min<int32_t>(namlen, TSPICE_DAF_NAME_BYTES);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  char out[TSPICE_DAF_NAME_BYTES] = {};
  if (!DafSuccess(env, tspice_dafgn(handle, namlen, out, err, sizeof(err)), "dafgn", err)) return env.Undefined();
  const size_t length = std::find(out, out + sizeof(out), char(0)) - out;
  auto result = Napi::Uint8Array::New(env, length);
  std::memcpy(result.Data(), out, length);
  return result;
}

static Napi::Value Dafgs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!DafArgs(info, 1)) return env.Undefined();
  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "DAF handle", &handle)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  unsigned char out[TSPICE_DAF_SUMMARY_BYTES] = {};
  int length = 0;
  if (!DafSuccess(env, tspice_dafgs(handle, out, sizeof(out), &length, err, sizeof(err)), "dafgs", err)) return env.Undefined();
  auto result = Napi::Uint8Array::New(env, length);
  std::memcpy(result.Data(), out, length);
  return result;
}

static Napi::Value Dafhsf(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!DafArgs(info, 1)) return env.Undefined();
  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "DAF handle", &handle)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int nd = 0, ni = 0;
  if (!DafSuccess(env, tspice_dafhsf(handle, &nd, &ni, err, sizeof(err)), "dafhsf", err)) return env.Undefined();
  auto out = Napi::Object::New(env);
  out.Set("nd", nd);
  out.Set("ni", ni);
  return out;
}

static Napi::Value Dafopw(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!DafArgs(info, 1)) return env.Undefined();
  if (!info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "DAF path must be a string"));
    return env.Undefined();
  }
  const auto value = info[0].As<Napi::String>();
  const auto utf16 = value.Utf16Value();
  for (size_t i = 0; i < utf16.size(); ++i) {
    const char16_t ch = utf16[i];
    if (ch == 0 || (ch >= 0xdc00 && ch <= 0xdfff) ||
        (ch >= 0xd800 && ch <= 0xdbff &&
         (++i == utf16.size() || utf16[i] < 0xdc00 || utf16[i] > 0xdfff))) {
      ThrowSpiceError(Napi::TypeError::New(env, "DAF path must be well-formed text without NUL"));
      return env.Undefined();
    }
  }
  const std::string path = value.Utf8Value();
  if (path.size() >= INT32_MAX) {
    ThrowSpiceError(Napi::RangeError::New(env, "DAF path exceeds signed byte count"));
    return env.Undefined();
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int handle = 0;
  if (!DafSuccess(env, tspice_dafopw(path.c_str(), &handle, err, sizeof(err)), "dafopw", err)) return env.Undefined();
  return Napi::Number::New(env, handle);
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
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling dafopr(\"") + PreviewForError(path) + "\")",
        err);
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
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling dasopr(\"") + PreviewForError(path) + "\")",
        err);
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
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling dlaopn(\"") + PreviewForError(path) + "\")",
        err);
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
  {
    Napi::Array arr = info[1].As<Napi::Array>();
    if (arr.Length() != expectedVrtcesLen) {
      ThrowSpiceError(Napi::TypeError::New(
          env,
          std::string("vrtces must have length ") + std::to_string(expectedVrtcesLen)));
      return Napi::Object::New(env);
    }
    vrtces.resize(expectedVrtcesLen);
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
  {
    Napi::Array arr = info[3].As<Napi::Array>();
    if (arr.Length() != expectedPlatesLen) {
      ThrowSpiceError(Napi::TypeError::New(
          env,
          std::string("plates must have length ") + std::to_string(expectedPlatesLen)));
      return Napi::Object::New(env);
    }
    plates.resize(expectedPlatesLen);
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
    vrtces.resize(expectedVrtcesLen);
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
    plates.resize(expectedPlatesLen);
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

  if (!SetExportChecked(env, exports, "dafac", Napi::Function::New(env, Dafac), __func__)) return;
  if (!SetExportChecked(env, exports, "dafdc", Napi::Function::New(env, Dafdc), __func__)) return;
  if (!SetExportChecked(env, exports, "dafec", Napi::Function::New(env, Dafec), __func__)) return;
  if (!SetExportChecked(env, exports, "dafrs", Napi::Function::New(env, Dafrs), __func__)) return;
  if (!SetExportChecked(env, exports, "dafps", Napi::Function::New(env, Dafps), __func__)) return;
  if (!SetExportChecked(env, exports, "dafus", Napi::Function::New(env, Dafus), __func__)) return;
  if (!SetExportChecked(env, exports, "dafgsr", Napi::Function::New(env, Dafgsr), __func__)) return;
  if (!SetExportChecked(env, exports, "dafrfr", Napi::Function::New(env, Dafrfr), __func__)) return;
  if (!SetExportChecked(env, exports, "dafrda", Napi::Function::New(env, Dafrda), __func__)) return;
  if (!SetExportChecked(env, exports, "dafgda", Napi::Function::New(env, Dafgda), __func__)) return;
  if (!SetExportChecked(env, exports, "dafbbs", Napi::Function::New(env, Dafbbs), __func__)) return;
  if (!SetExportChecked(env, exports, "dafcs", Napi::Function::New(env, Dafcs), __func__)) return;
  if (!SetExportChecked(env, exports, "daffpa", Napi::Function::New(env, Daffpa), __func__)) return;
  if (!SetExportChecked(env, exports, "dafgh", Napi::Function::New(env, Dafgh), __func__)) return;
  if (!SetExportChecked(env, exports, "dafgn", Napi::Function::New(env, Dafgn), __func__)) return;
  if (!SetExportChecked(env, exports, "dafgs", Napi::Function::New(env, Dafgs), __func__)) return;
  if (!SetExportChecked(env, exports, "dafhsf", Napi::Function::New(env, Dafhsf), __func__)) return;
  if (!SetExportChecked(env, exports, "dafopw", Napi::Function::New(env, Dafopw), __func__)) return;
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
