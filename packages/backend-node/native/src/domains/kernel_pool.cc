#include "kernel_pool.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <limits>
#include <string>
#include <string_view>
#include <vector>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::FixedWidthToJsString;
using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::PreviewForError;
using tspice_napi::ReadStringArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

namespace {

constexpr size_t kPoolStringMaxBytes = tspice_backend_node::kOutMaxBytes;
constexpr size_t kPoolNameMaxBytes = 64;

Napi::Array MakeIntArray(Napi::Env env, const int* values, size_t count) {
  Napi::Array arr = Napi::Array::New(env, count);
  for (size_t i = 0; i < count; i++) {
    arr.Set(i, Napi::Number::New(env, static_cast<double>(values[i])));
  }
  return arr;
}

template <size_t N>
inline void CopyToFixedWidth(std::array<char, N>& out, std::string_view value) {
  static_assert(N > 0);
  out.fill('\0');
  const size_t copyLen = std::min(value.size(), N - 1);
  if (copyLen > 0) {
    memcpy(out.data(), value.data(), copyLen);
  }
  out[copyLen] = '\0';
}

inline bool IsEmptyOrAsciiWhitespaceOnly(std::string_view value) {
  if (value.empty()) return true;
  for (unsigned char c : value) {
    if (!tspice_napi::IsAsciiWhitespace(c)) {
      return false;
    }
  }
  return true;
}

inline bool ValidateNonEmptyString(
    Napi::Env env,
    const char* fn,
    const char* field,
    std::string_view value) {
  if (!IsEmptyOrAsciiWhitespaceOnly(value)) {
    return true;
  }

  const char* safeFn = (fn != nullptr) ? fn : "<unknown>";
  const char* safeField = (field != nullptr) ? field : "<unknown>";
  ThrowSpiceError(Napi::RangeError::New(
      env,
      std::string(safeFn) + "(): " + safeField + " must be a non-empty string"));
  return false;
}

}  // namespace

static bool ReadText(Napi::Env env, const Napi::Value& value, std::string* text,
                     size_t maxBytes = std::numeric_limits<int>::max() - 1) {
  if (!value.IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a string"));
    return false;
  }
  size_t bytes = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &bytes) != napi_ok || bytes > maxBytes) {
    ThrowSpiceError(Napi::RangeError::New(env, "String exceeds its UTF-8 byte limit"));
    return false;
  }
  const Napi::String input = value.As<Napi::String>();
  // N-API replaces unpaired surrogates when encoding UTF-8. Validate the
  // original UTF-16 units before making the C string.
  const std::u16string units = input.Utf16Value();
  for (size_t i = 0; i < units.size(); i++) {
    const char16_t c = units[i];
    if (c == 0) {
      ThrowSpiceError(Napi::TypeError::New(env, "Input contains an embedded NUL"));
      return false;
    }
    if (c >= 0xd800 && c <= 0xdfff) {
      if (c > 0xdbff || i + 1 == units.size() || units[i+1] < 0xdc00 || units[i+1] > 0xdfff) {
        ThrowSpiceError(Napi::TypeError::New(env, "Input contains an unpaired UTF-16 surrogate"));
        return false;
      }
      i++;
    }
  }
  *text = input.Utf8Value();
  return true;
}

static bool ReadChar(Napi::Env env, const Napi::Value& value, int* out) {
  size_t units = 0;
  if (value.IsString() && napi_get_value_string_utf16(env, value, nullptr, 0, &units) == napi_ok && units == 1) {
    const auto text = value.As<Napi::String>().Utf16Value();
    if (text.size() == 1 && text[0] <= 127) { *out = text[0]; return true; }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected one ASCII byte"));
  return false;
}

static bool ReadInt(Napi::Env env, const Napi::Value& value, int* out) {
  if (value.IsNumber()) {
    const double n = value.As<Napi::Number>().DoubleValue();
    if (std::isfinite(n) && std::trunc(n) == n && n >= -2147483648.0 && n <= 2147483647.0) {
      *out = static_cast<int>(n);
      return true;
    }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a signed32 integer"));
  return false;
}

static Napi::Value StringResult(Napi::Env env, const std::vector<char>& out) {
  const auto end = std::find(out.begin(), out.end(), '\0');
  if (end == out.end()) {
    ThrowSpiceError(Napi::Error::New(env, "CSPICE string result has no NUL terminator"));
    return env.Undefined();
  }
  const size_t length = static_cast<size_t>(end - out.begin());
  const auto result = Napi::String::New(env, out.data(), length);
  // N-API decodes invalid UTF-8 with replacement. A round trip must preserve
  // every byte, including a leading BOM and trailing whitespace.
  const std::string decoded = result.Utf8Value();
  if (decoded.size() != length || std::memcmp(decoded.data(), out.data(), length) != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "CSPICE string result is not valid UTF-8"));
    return env.Undefined();
  }
  return result;
}

static Napi::Value Badkpv(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 6) {
    ThrowSpiceError(Napi::TypeError::New(env, "badkpv() expects 6 arguments"));
    return env.Undefined();
  }
  std::string caller;
  if (!ReadText(env, info[0], &caller)) return env.Undefined();
  std::string name;
  if (!ReadText(env, info[1], &name)) return env.Undefined();
  std::string comp;
  if (!ReadText(env, info[2], &comp)) return env.Undefined();
  int size = 0;
  if (!ReadInt(env, info[3], &size)) return env.Undefined();
  int divby = 0;
  if (!ReadInt(env, info[4], &divby)) return env.Undefined();
  int type = 0;
  if (!ReadChar(env, info[5], &type)) return env.Undefined();
  int bad = 0;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_badkpv(caller.c_str(), name.c_str(), comp.c_str(), size, divby, type, &bad, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling badkpv()", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, bad != 0);
}

static Napi::Value Bodvcd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "bodvcd() expects 3 arguments"));
    return env.Undefined();
  }
  int body = 0;
  if (!ReadInt(env, info[0], &body)) return env.Undefined();
  std::string item;
  if (!ReadText(env, info[1], &item)) return env.Undefined();
  int maxn = 0;
  if (!ReadInt(env, info[2], &maxn)) return env.Undefined();
  const int capacity = std::max(1, std::min(maxn, TSPICE_POOL_MAX_VALUES));
  int dim = 0;
  std::vector<double> values(static_cast<size_t>(capacity));
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_bodvcd(body, item.c_str(), maxn, &dim, values.data(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling bodvcd()", err);
    return env.Undefined();
  }
  if (dim < 0 || dim > maxn || dim > capacity) {
    ThrowSpiceError(Napi::Error::New(env, "Invalid body constant output dimension"));
    return env.Undefined();
  }
  auto result = Napi::Object::New(env);
  result.Set("dim", dim);
  result.Set("values", MakeNumberArray(env, values.data(), static_cast<size_t>(dim)));
  return result;
}

static Napi::Value Bodvrd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "bodvrd() expects 3 arguments"));
    return env.Undefined();
  }
  std::string body;
  if (!ReadText(env, info[0], &body)) return env.Undefined();
  std::string item;
  if (!ReadText(env, info[1], &item)) return env.Undefined();
  int maxn = 0;
  if (!ReadInt(env, info[2], &maxn)) return env.Undefined();
  const int capacity = std::max(1, std::min(maxn, TSPICE_POOL_MAX_VALUES));
  int dim = 0;
  std::vector<double> values(static_cast<size_t>(capacity));
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_bodvrd(body.c_str(), item.c_str(), maxn, &dim, values.data(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling bodvrd()", err);
    return env.Undefined();
  }
  if (dim < 0 || dim > maxn || dim > capacity) {
    ThrowSpiceError(Napi::Error::New(env, "Invalid body constant output dimension"));
    return env.Undefined();
  }
  auto result = Napi::Object::New(env);
  result.Set("dim", dim);
  result.Set("values", MakeNumberArray(env, values.data(), static_cast<size_t>(dim)));
  return result;
}

static Napi::Value Clpool(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "clpool() expects 0 arguments"));
    return env.Undefined();
  }
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_clpool(err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling clpool()", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Dvpool(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "dvpool() expects 1 arguments"));
    return env.Undefined();
  }
  std::string name;
  if (!ReadText(env, info[0], &name)) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_dvpool(name.c_str(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dvpool()", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Ldpool(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "ldpool() expects 1 arguments"));
    return env.Undefined();
  }
  std::string path;
  if (!ReadText(env, info[0], &path)) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_ldpool(path.c_str(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ldpool()", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Lmpool(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "lmpool() expects 1 arguments"));
    return env.Undefined();
  }
  if (!info[0].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "lmpool lines must be an array"));
    return env.Undefined();
  }
  const auto input = info[0].As<Napi::Array>();
  const uint32_t count = input.Length();
  constexpr size_t maxBytes = std::numeric_limits<int>::max();
  if (count > maxBytes / 2) {
    ThrowSpiceError(Napi::RangeError::New(env, "lmpool table is too large"));
    return env.Undefined();
  }
  size_t stride = 2;
  std::vector<std::string> lines;
  for (uint32_t i = 0; i < count; ++i) {
    const auto value = input.Get(i);
    std::string line;
    if (env.IsExceptionPending() || !ReadText(env, value, &line, maxBytes / count - 1)) return env.Undefined();
    stride = std::max(stride, line.size() + 1);
    lines.push_back(std::move(line));
  }
  std::vector<char> rows(std::max<size_t>(1, count) * stride, 0);
  for (size_t i = 0; i < lines.size(); ++i) {
    std::memcpy(rows.data() + i * stride, lines[i].data(), lines[i].size());
  }
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_lmpool(rows.data(), static_cast<int>(stride), static_cast<int>(count), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lmpool()", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Stpool(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "stpool() expects 4 arguments"));
    return env.Undefined();
  }
  std::string item;
  if (!ReadText(env, info[0], &item)) return env.Undefined();
  int nth = 0;
  if (!ReadInt(env, info[1], &nth)) return env.Undefined();
  std::string contin;
  if (!ReadText(env, info[2], &contin)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[3], &lenout)) return env.Undefined();
  const int capacity = std::max(1, std::min(lenout, TSPICE_POOL_TEXT_CAPACITY));
  std::vector<char> text(static_cast<size_t>(capacity));
  int size = 0, found = 0;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_stpool(item.c_str(), nth, contin.c_str(), lenout, text.data(), &size, &found, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling stpool()", err);
    return env.Undefined();
  }
  if (!found) return MakeNotFound(env);
  auto result = Napi::Object::New(env);
  result.Set("found", true);
  const Napi::Value value = StringResult(env, text);
  if (env.IsExceptionPending()) return env.Undefined();
  result.Set("nthstr", value);
  result.Set("size", size);
  return result;
}

static Napi::Value Szpool(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "szpool() expects 1 arguments"));
    return env.Undefined();
  }
  std::string name;
  if (!ReadText(env, info[0], &name)) return env.Undefined();
  int n = 0, found = 0;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  if (tspice_szpool(name.c_str(), &n, &found, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling szpool()", err);
    return env.Undefined();
  }
  if (!found) return MakeNotFound(env);
  auto result = Napi::Object::New(env);
  result.Set("found", true);
  result.Set("n", n);
  return result;
}

static Napi::Object Gdpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "gdpool(name: string, start: number, room: number) expects (string, number, number)"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  const int start = info[1].As<Napi::Number>().Int32Value();
  const int room = info[2].As<Napi::Number>().Int32Value();

  if (!ValidateNonEmptyString(env, "gdpool", "name", name)) {
    return Napi::Object::New(env);
  }

  if (start < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gdpool() expects start >= 0"));
    return Napi::Object::New(env);
  }

  if (room <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gdpool() expects room > 0"));
    return Napi::Object::New(env);
  }

  std::vector<double> values(static_cast<size_t>(room));

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int nOut = 0;
  int found = 0;

  const int code = tspice_gdpool(
      name.c_str(),
      start,
      room,
      &nOut,
      values.data(),
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling gdpool(\"") + PreviewForError(name) + "\")",
        err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  if (nOut < 0) nOut = 0;
  if (nOut > room) nOut = room;

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("values", MakeNumberArray(env, values.data(), static_cast<size_t>(nOut)));
  return result;
}

static Napi::Object Gipool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "gipool(name: string, start: number, room: number) expects (string, number, number)"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  const int start = info[1].As<Napi::Number>().Int32Value();
  const int room = info[2].As<Napi::Number>().Int32Value();

  if (!ValidateNonEmptyString(env, "gipool", "name", name)) {
    return Napi::Object::New(env);
  }

  if (start < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gipool() expects start >= 0"));
    return Napi::Object::New(env);
  }

  if (room <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gipool() expects room > 0"));
    return Napi::Object::New(env);
  }

  std::vector<int> values(static_cast<size_t>(room));

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int nOut = 0;
  int found = 0;

  const int code = tspice_gipool(
      name.c_str(),
      start,
      room,
      &nOut,
      values.data(),
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling gipool(\"") + PreviewForError(name) + "\")",
        err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  if (nOut < 0) nOut = 0;
  if (nOut > room) nOut = room;

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("values", MakeIntArray(env, values.data(), static_cast<size_t>(nOut)));
  return result;
}

static Napi::Object Gcpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "gcpool(name: string, start: number, room: number) expects (string, number, number)"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  const int start = info[1].As<Napi::Number>().Int32Value();
  const int room = info[2].As<Napi::Number>().Int32Value();

  if (!ValidateNonEmptyString(env, "gcpool", "name", name)) {
    return Napi::Object::New(env);
  }

  if (start < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gcpool() expects start >= 0"));
    return Napi::Object::New(env);
  }

  if (room <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gcpool() expects room > 0"));
    return Napi::Object::New(env);
  }

  // Fixed-width 2D buffer: room x kPoolStringMaxBytes.
  std::vector<std::array<char, kPoolStringMaxBytes>> cvals(static_cast<size_t>(room));

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int nOut = 0;
  int found = 0;

  const int code = tspice_gcpool(
      name.c_str(),
      start,
      room,
      (int)kPoolStringMaxBytes,
      &nOut,
      cvals.data(),
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling gcpool(\"") + PreviewForError(name) + "\")",
        err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  if (nOut < 0) nOut = 0;
  if (nOut > room) nOut = room;

  Napi::Array values = Napi::Array::New(env, static_cast<size_t>(nOut));
  for (int i = 0; i < nOut; i++) {
    values.Set(static_cast<uint32_t>(i), FixedWidthToJsString(env, cvals[(size_t)i].data(), kPoolStringMaxBytes));
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("values", values);
  return result;
}

static Napi::Object Gnpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "gnpool(template: string, start: number, room: number) expects (string, number, number)"));
    return Napi::Object::New(env);
  }

  const std::string templ = info[0].As<Napi::String>().Utf8Value();
  const int start = info[1].As<Napi::Number>().Int32Value();
  const int room = info[2].As<Napi::Number>().Int32Value();

  if (!ValidateNonEmptyString(env, "gnpool", "template", templ)) {
    return Napi::Object::New(env);
  }

  if (start < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gnpool() expects start >= 0"));
    return Napi::Object::New(env);
  }

  if (room <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "gnpool() expects room > 0"));
    return Napi::Object::New(env);
  }

  // Fixed-width 2D buffer: room x kPoolNameMaxBytes.
  std::vector<std::array<char, kPoolNameMaxBytes>> cvals(static_cast<size_t>(room));

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int nOut = 0;
  int found = 0;

  const int code = tspice_gnpool(
      templ.c_str(),
      start,
      room,
      (int)kPoolNameMaxBytes,
      &nOut,
      cvals.data(),
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling gnpool(\"") + PreviewForError(templ) + "\")",
        err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  if (nOut < 0) nOut = 0;
  if (nOut > room) nOut = room;

  Napi::Array values = Napi::Array::New(env, static_cast<size_t>(nOut));
  for (int i = 0; i < nOut; i++) {
    values.Set(static_cast<uint32_t>(i), FixedWidthToJsString(env, cvals[(size_t)i].data(), kPoolNameMaxBytes));
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("values", values);
  return result;
}

static Napi::Object Dtpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "dtpool(name: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  if (!ValidateNonEmptyString(env, "dtpool", "name", name)) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int found = 0;
  int nOut = 0;
  char typeOut[2] = {'X', '\0'};

  const int code = tspice_dtpool(
      name.c_str(),
      &found,
      &nOut,
      typeOut,
      (int)sizeof(typeOut),
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling dtpool(\"") + PreviewForError(name) + "\")",
        err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  const char t = typeOut[0];
  if (t != 'C' && t != 'N') {
    ThrowSpiceError(Napi::Error::New(env, "dtpool() returned unexpected type"));
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("n", Napi::Number::New(env, static_cast<double>(nOut)));
  result.Set("type", Napi::String::New(env, std::string(1, t)));
  return result;
}

static void Pdpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "pdpool(name: string, values: number[]) expects (string, number[])"));
    return;
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  if (!ValidateNonEmptyString(env, "pdpool", "name", name)) {
    return;
  }
  Napi::Array arr = info[1].As<Napi::Array>();

  const uint32_t n = arr.Length();
  std::vector<double> values;
  values.reserve(n);

  for (uint32_t i = 0; i < n; i++) {
    const Napi::Value v = arr.Get(i);
    if (!v.IsNumber()) {
      ThrowSpiceError(Napi::TypeError::New(env, "pdpool values must contain only numbers"));
      return;
    }
    const double d = v.As<Napi::Number>().DoubleValue();
    if (!std::isfinite(d)) {
      ThrowSpiceError(Napi::RangeError::New(env, "pdpool(): values must contain only finite numbers"));
      return;
    }
    values.push_back(d);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_pdpool(name.c_str(), (int)values.size(), values.data(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling pdpool(\"") + PreviewForError(name) + "\")",
        err);
  }
}

static void Pipool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "pipool(name: string, values: number[]) expects (string, number[])"));
    return;
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  if (!ValidateNonEmptyString(env, "pipool", "name", name)) {
    return;
  }
  Napi::Array arr = info[1].As<Napi::Array>();

  const uint32_t n = arr.Length();
  std::vector<int> values;
  values.reserve(n);

  for (uint32_t i = 0; i < n; i++) {
    const Napi::Value v = arr.Get(i);
    if (!v.IsNumber()) {
      ThrowSpiceError(Napi::TypeError::New(env, "pipool values must contain only numbers"));
      return;
    }
    const double d = v.As<Napi::Number>().DoubleValue();
    const bool isInteger = std::isfinite(d) && std::trunc(d) == d;
    // Equivalent to JS `Number.isSafeInteger` for values that matter here.
    const bool isSafeInteger = isInteger && std::fabs(d) <= 9007199254740991.0;  // 2^53 - 1

    if (!isSafeInteger) {
      ThrowSpiceError(Napi::TypeError::New(
          env,
          std::string("pipool(): values[") + std::to_string(i) + "] must be a safe integer"));
      return;
    }

    if (d < -2147483648.0 || d > 2147483647.0) {
      ThrowSpiceError(Napi::RangeError::New(
          env,
          std::string("pipool(): values[") + std::to_string(i) + "] must be a 32-bit signed integer"));
      return;
    }

    values.push_back(static_cast<int>(d));
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_pipool(name.c_str(), (int)values.size(), values.data(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling pipool(\"") + PreviewForError(name) + "\")",
        err);
  }
}

static void Pcpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "pcpool(name: string, values: string[]) expects (string, string[])"));
    return;
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  if (!ValidateNonEmptyString(env, "pcpool", "name", name)) {
    return;
  }

  tspice_napi::JsStringArrayArg values;
  if (!ReadStringArray(env, info[1], &values, "values")) {
    return;
  }

  // Fixed-width 2D buffer: n x kPoolStringMaxBytes.
  // CSPICE requires a non-null buffer even for a zero-count no-op write.
  std::vector<std::array<char, kPoolStringMaxBytes>> cvals(std::max<size_t>(1, values.values.size()));
  for (size_t i = 0; i < values.values.size(); i++) {
    CopyToFixedWidth(cvals[i], values.values[i]);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_pcpool(
      name.c_str(),
      (int)values.values.size(),
      (int)kPoolStringMaxBytes,
      cvals.data(),
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling pcpool(\"") + PreviewForError(name) + "\")",
        err);
  }
}

static void Swpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "swpool(agent: string, names: string[]) expects (string, string[])"));
    return;
  }

  const std::string agent = info[0].As<Napi::String>().Utf8Value();

  if (!ValidateNonEmptyString(env, "swpool", "agent", agent)) {
    return;
  }

  tspice_napi::JsStringArrayArg names;
  if (!ReadStringArray(env, info[1], &names, "names")) {
    return;
  }

  for (size_t i = 0; i < names.values.size(); i++) {
    if (IsEmptyOrAsciiWhitespaceOnly(names.values[i])) {
      ThrowSpiceError(Napi::RangeError::New(
          env,
          std::string("swpool(): names[") + std::to_string(i) + "] must be a non-empty string"));
      return;
    }
  }

  // Fixed-width 2D buffer: nnames x kPoolNameMaxBytes.
  std::vector<std::array<char, kPoolNameMaxBytes>> namesBuf(names.values.size());
  for (size_t i = 0; i < names.values.size(); i++) {
    CopyToFixedWidth(namesBuf[i], names.values[i]);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_swpool(
      agent.c_str(),
      (int)namesBuf.size(),
      (int)kPoolNameMaxBytes,
      namesBuf.data(),
      err,
      (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling swpool(\"") + PreviewForError(agent) + "\")",
        err);
  }
}

static Napi::Boolean Cvpool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "cvpool(agent: string) expects exactly one string argument"));
    return Napi::Boolean::New(env, false);
  }

  const std::string agent = info[0].As<Napi::String>().Utf8Value();

  if (!ValidateNonEmptyString(env, "cvpool", "agent", agent)) {
    return Napi::Boolean::New(env, false);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int update = 0;
  const int code = tspice_cvpool(agent.c_str(), &update, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling cvpool(\"") + PreviewForError(agent) + "\")",
        err);
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, update != 0);
}

static Napi::Boolean Expool(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "expool(name: string) expects exactly one string argument"));
    return Napi::Boolean::New(env, false);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  if (!ValidateNonEmptyString(env, "expool", "name", name)) {
    return Napi::Boolean::New(env, false);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int found = 0;
  const int code = tspice_expool(name.c_str(), &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling expool(\"") + PreviewForError(name) + "\")",
        err);
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, found != 0);
}

namespace tspice_backend_node {

void RegisterKernelPool(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "badkpv", Napi::Function::New(env, Badkpv), __func__)) return;
  if (!SetExportChecked(env, exports, "bodvcd", Napi::Function::New(env, Bodvcd), __func__)) return;
  if (!SetExportChecked(env, exports, "bodvrd", Napi::Function::New(env, Bodvrd), __func__)) return;
  if (!SetExportChecked(env, exports, "clpool", Napi::Function::New(env, Clpool), __func__)) return;
  if (!SetExportChecked(env, exports, "dvpool", Napi::Function::New(env, Dvpool), __func__)) return;
  if (!SetExportChecked(env, exports, "ldpool", Napi::Function::New(env, Ldpool), __func__)) return;
  if (!SetExportChecked(env, exports, "lmpool", Napi::Function::New(env, Lmpool), __func__)) return;
  if (!SetExportChecked(env, exports, "stpool", Napi::Function::New(env, Stpool), __func__)) return;
  if (!SetExportChecked(env, exports, "szpool", Napi::Function::New(env, Szpool), __func__)) return;
  if (!SetExportChecked(env, exports, "gdpool", Napi::Function::New(env, Gdpool), __func__)) return;
  if (!SetExportChecked(env, exports, "gipool", Napi::Function::New(env, Gipool), __func__)) return;
  if (!SetExportChecked(env, exports, "gcpool", Napi::Function::New(env, Gcpool), __func__)) return;
  if (!SetExportChecked(env, exports, "gnpool", Napi::Function::New(env, Gnpool), __func__)) return;
  if (!SetExportChecked(env, exports, "dtpool", Napi::Function::New(env, Dtpool), __func__)) return;

  if (!SetExportChecked(env, exports, "pdpool", Napi::Function::New(env, Pdpool), __func__)) return;
  if (!SetExportChecked(env, exports, "pipool", Napi::Function::New(env, Pipool), __func__)) return;
  if (!SetExportChecked(env, exports, "pcpool", Napi::Function::New(env, Pcpool), __func__)) return;

  if (!SetExportChecked(env, exports, "swpool", Napi::Function::New(env, Swpool), __func__)) return;
  if (!SetExportChecked(env, exports, "cvpool", Napi::Function::New(env, Cvpool), __func__)) return;
  if (!SetExportChecked(env, exports, "expool", Napi::Function::New(env, Expool), __func__)) return;
}

}  // namespace tspice_backend_node
