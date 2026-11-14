#include "strings.h"
#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>
#include <string>
#include <vector>

using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static bool ReadText(Napi::Env env, const Napi::Value& value, std::string* text) {
  if (!value.IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a string"));
    return false;
  }
  size_t bytes = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &bytes) != napi_ok || bytes >= std::numeric_limits<int>::max()) {
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

static bool ReadFinite(Napi::Env env, const Napi::Value& value, double* out) {
  if (value.IsNumber()) {
    *out = value.As<Napi::Number>().DoubleValue();
    if (std::isfinite(*out)) return true;
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a finite number"));
  return false;
}

static Napi::Value Dp2hx(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "dp2hx() expects 2 arguments"));
    return env.Undefined();
  }
  double value = 0;
  if (!ReadFinite(env, info[0], &value)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[1], &lenout)) return env.Undefined();
  lenout = std::min(lenout, 256);
  std::vector<char> text(static_cast<size_t>(std::max(1,lenout)), 0);
  int size = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_dp2hx(value, lenout, text.data(), &size, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling dp2hx", err);
    return env.Undefined();
  }
  const auto string = StringResult(env, text);
  if (env.IsExceptionPending()) return env.Undefined();
  const auto result = Napi::Object::New(env);
  result.Set("hxstr", string);
  result.Set("hxssiz", size);
  return result;
}

static Napi::Value Hx2dp(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "hx2dp() expects 2 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[1], &lenout)) return env.Undefined();
  lenout = std::min(lenout, 193);
  double number = 0;
  int error = 0;
  std::vector<char> text(static_cast<size_t>(std::max(1,lenout)), 0);
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_hx2dp(input.c_str(), lenout, &number, &error, text.data(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling hx2dp", err);
    return env.Undefined();
  }
  const auto string = StringResult(env, text);
  if (env.IsExceptionPending()) return env.Undefined();
  const auto result = Napi::Object::New(env);
  result.Set("errmsg", string);
  result.Set("error", error != 0);
  if (!error) result.Set("number", number);
  return result;
}

static Napi::Value Prsdp(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "prsdp() expects 1 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  double number = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_prsdp(input.c_str(), &number, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling prsdp", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, number);
}

static Napi::Value Prsint(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "prsint() expects 1 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  int number = 0;
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_prsint(input.c_str(), &number, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling prsint", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, number);
}

static Napi::Value Repmc(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "repmc() expects 4 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  std::string marker;
  if (!ReadText(env, info[1], &marker)) return env.Undefined();
  std::string value;
  if (!ReadText(env, info[2], &value)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[3], &lenout)) return env.Undefined();
  const size_t extra = std::max<size_t>(1, value.size());
  if (input.size() > static_cast<size_t>(std::numeric_limits<int>::max()) - extra - 1) {
    ThrowSpiceError(Napi::RangeError::New(env, "Replacement result exceeds signed32 storage"));
    return env.Undefined();
  }
  lenout = std::min(lenout, static_cast<int>(input.size() + extra + 1));
  std::vector<char> text(static_cast<size_t>(std::max(1,lenout)), 0);
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_repmc(input.c_str(), marker.c_str(), value.c_str(), lenout, text.data(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling repmc", err);
    return env.Undefined();
  }
  return StringResult(env, text);
}

static Napi::Value Repmct(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "repmct() expects 5 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  std::string marker;
  if (!ReadText(env, info[1], &marker)) return env.Undefined();
  int value = 0;
  if (!ReadInt(env, info[2], &value)) return env.Undefined();
  int rtcase = 0;
  if (!ReadChar(env, info[3], &rtcase)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[4], &lenout)) return env.Undefined();
  const size_t extra = 145;
  if (input.size() > static_cast<size_t>(std::numeric_limits<int>::max()) - extra - 1) {
    ThrowSpiceError(Napi::RangeError::New(env, "Replacement result exceeds signed32 storage"));
    return env.Undefined();
  }
  lenout = std::min(lenout, static_cast<int>(input.size() + extra + 1));
  std::vector<char> text(static_cast<size_t>(std::max(1,lenout)), 0);
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_repmct(input.c_str(), marker.c_str(), value, rtcase, lenout, text.data(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling repmct", err);
    return env.Undefined();
  }
  return StringResult(env, text);
}

static Napi::Value Repmd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "repmd() expects 5 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  std::string marker;
  if (!ReadText(env, info[1], &marker)) return env.Undefined();
  double value = 0;
  if (!ReadFinite(env, info[2], &value)) return env.Undefined();
  int sigdig = 0;
  if (!ReadInt(env, info[3], &sigdig)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[4], &lenout)) return env.Undefined();
  const size_t extra = 23;
  if (input.size() > static_cast<size_t>(std::numeric_limits<int>::max()) - extra - 1) {
    ThrowSpiceError(Napi::RangeError::New(env, "Replacement result exceeds signed32 storage"));
    return env.Undefined();
  }
  lenout = std::min(lenout, static_cast<int>(input.size() + extra + 1));
  std::vector<char> text(static_cast<size_t>(std::max(1,lenout)), 0);
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_repmd(input.c_str(), marker.c_str(), value, sigdig, lenout, text.data(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling repmd", err);
    return env.Undefined();
  }
  return StringResult(env, text);
}

static Napi::Value Repmf(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 6) {
    ThrowSpiceError(Napi::TypeError::New(env, "repmf() expects 6 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  std::string marker;
  if (!ReadText(env, info[1], &marker)) return env.Undefined();
  double value = 0;
  if (!ReadFinite(env, info[2], &value)) return env.Undefined();
  int sigdig = 0;
  if (!ReadInt(env, info[3], &sigdig)) return env.Undefined();
  int format = 0;
  if (!ReadChar(env, info[4], &format)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[5], &lenout)) return env.Undefined();
  const size_t extra = 56;
  if (input.size() > static_cast<size_t>(std::numeric_limits<int>::max()) - extra - 1) {
    ThrowSpiceError(Napi::RangeError::New(env, "Replacement result exceeds signed32 storage"));
    return env.Undefined();
  }
  lenout = std::min(lenout, static_cast<int>(input.size() + extra + 1));
  std::vector<char> text(static_cast<size_t>(std::max(1,lenout)), 0);
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_repmf(input.c_str(), marker.c_str(), value, sigdig, format, lenout, text.data(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling repmf", err);
    return env.Undefined();
  }
  return StringResult(env, text);
}

static Napi::Value Repmi(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "repmi() expects 4 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  std::string marker;
  if (!ReadText(env, info[1], &marker)) return env.Undefined();
  int value = 0;
  if (!ReadInt(env, info[2], &value)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[3], &lenout)) return env.Undefined();
  const size_t extra = 11;
  if (input.size() > static_cast<size_t>(std::numeric_limits<int>::max()) - extra - 1) {
    ThrowSpiceError(Napi::RangeError::New(env, "Replacement result exceeds signed32 storage"));
    return env.Undefined();
  }
  lenout = std::min(lenout, static_cast<int>(input.size() + extra + 1));
  std::vector<char> text(static_cast<size_t>(std::max(1,lenout)), 0);
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_repmi(input.c_str(), marker.c_str(), value, lenout, text.data(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling repmi", err);
    return env.Undefined();
  }
  return StringResult(env, text);
}

static Napi::Value Repml(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "repml() expects 5 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  std::string marker;
  if (!ReadText(env, info[1], &marker)) return env.Undefined();
  if (!info[2].IsBoolean()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a boolean"));
    return env.Undefined();
  }
  const bool value = info[2].As<Napi::Boolean>().Value();
  int rtcase = 0;
  if (!ReadChar(env, info[3], &rtcase)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[4], &lenout)) return env.Undefined();
  const size_t extra = 5;
  if (input.size() > static_cast<size_t>(std::numeric_limits<int>::max()) - extra - 1) {
    ThrowSpiceError(Napi::RangeError::New(env, "Replacement result exceeds signed32 storage"));
    return env.Undefined();
  }
  lenout = std::min(lenout, static_cast<int>(input.size() + extra + 1));
  std::vector<char> text(static_cast<size_t>(std::max(1,lenout)), 0);
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_repml(input.c_str(), marker.c_str(), value, rtcase, lenout, text.data(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling repml", err);
    return env.Undefined();
  }
  return StringResult(env, text);
}

static Napi::Value Repmot(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 5) {
    ThrowSpiceError(Napi::TypeError::New(env, "repmot() expects 5 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  std::string marker;
  if (!ReadText(env, info[1], &marker)) return env.Undefined();
  int value = 0;
  if (!ReadInt(env, info[2], &value)) return env.Undefined();
  int rtcase = 0;
  if (!ReadChar(env, info[3], &rtcase)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[4], &lenout)) return env.Undefined();
  const size_t extra = 147;
  if (input.size() > static_cast<size_t>(std::numeric_limits<int>::max()) - extra - 1) {
    ThrowSpiceError(Napi::RangeError::New(env, "Replacement result exceeds signed32 storage"));
    return env.Undefined();
  }
  lenout = std::min(lenout, static_cast<int>(input.size() + extra + 1));
  std::vector<char> text(static_cast<size_t>(std::max(1,lenout)), 0);
  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_repmot(input.c_str(), marker.c_str(), value, rtcase, lenout, text.data(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling repmot", err);
    return env.Undefined();
  }
  return StringResult(env, text);
}

static Napi::Value Cmprss(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "cmprss() expects 4 arguments"));
    return env.Undefined();
  }
  int delim = 0;
  if (!ReadChar(env, info[0], &delim)) return env.Undefined();
  int n = 0;
  if (!ReadInt(env, info[1], &n)) return env.Undefined();
  std::string input;
  if (!ReadText(env, info[2], &input)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[3], &lenout)) return env.Undefined();
  const int full = std::max(1, static_cast<int>(input.size()) + 1);
  lenout = std::min(lenout, full);
  std::vector<char> out(static_cast<size_t>(std::max(1, lenout)), 0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_cmprss(delim, n, input.c_str(), lenout, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling cmprss", err);
    return env.Undefined();
  }
  return StringResult(env, out);
}

static Napi::Value Eqstr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "eqstr() expects 2 arguments"));
    return env.Undefined();
  }
  std::string a;
  if (!ReadText(env, info[0], &a)) return env.Undefined();
  std::string b;
  if (!ReadText(env, info[1], &b)) return env.Undefined();
  int out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_eqstr(a.c_str(), b.c_str(), &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling eqstr", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Iswhsp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "iswhsp() expects 1 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  int out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_iswhsp(input.c_str(), &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling iswhsp", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Lastnb(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "lastnb() expects 1 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  int out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_lastnb(input.c_str(), &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lastnb", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Lcase(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "lcase() expects 2 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[1], &lenout)) return env.Undefined();
  const int full = std::max(2, static_cast<int>(input.size()) + 1);
  lenout = std::min(lenout, full);
  std::vector<char> out(static_cast<size_t>(std::max(1, lenout)), 0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_lcase(input.data(), lenout, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lcase", err);
    return env.Undefined();
  }
  return StringResult(env, out);
}

static Napi::Value Ucase(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "ucase() expects 2 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  int lenout = 0;
  if (!ReadInt(env, info[1], &lenout)) return env.Undefined();
  const int full = std::max(2, static_cast<int>(input.size()) + 1);
  lenout = std::min(lenout, full);
  std::vector<char> out(static_cast<size_t>(std::max(1, lenout)), 0);
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_ucase(input.data(), lenout, out.data(), err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ucase", err);
    return env.Undefined();
  }
  return StringResult(env, out);
}

static Napi::Value Matchi(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "matchi() expects 4 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  std::string templ;
  if (!ReadText(env, info[1], &templ)) return env.Undefined();
  int wstr = 0;
  if (!ReadChar(env, info[2], &wstr)) return env.Undefined();
  int wchr = 0;
  if (!ReadChar(env, info[3], &wchr)) return env.Undefined();
  int out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_matchi(input.c_str(), templ.c_str(), wstr, wchr, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling matchi", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Matchw(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "matchw() expects 4 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!ReadText(env, info[0], &input)) return env.Undefined();
  std::string templ;
  if (!ReadText(env, info[1], &templ)) return env.Undefined();
  int wstr = 0;
  if (!ReadChar(env, info[2], &wstr)) return env.Undefined();
  int wchr = 0;
  if (!ReadChar(env, info[3], &wchr)) return env.Undefined();
  int out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int status = tspice_matchw(input.c_str(), templ.c_str(), wstr, wchr, &out, err, (int)sizeof(err));
  if (status != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling matchw", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

namespace tspice_backend_node {

void RegisterStrings(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "dp2hx", Napi::Function::New(env, Dp2hx), __func__)) return;
  if (!SetExportChecked(env, exports, "hx2dp", Napi::Function::New(env, Hx2dp), __func__)) return;
  if (!SetExportChecked(env, exports, "prsdp", Napi::Function::New(env, Prsdp), __func__)) return;
  if (!SetExportChecked(env, exports, "prsint", Napi::Function::New(env, Prsint), __func__)) return;
  if (!SetExportChecked(env, exports, "repmc", Napi::Function::New(env, Repmc), __func__)) return;
  if (!SetExportChecked(env, exports, "repmct", Napi::Function::New(env, Repmct), __func__)) return;
  if (!SetExportChecked(env, exports, "repmd", Napi::Function::New(env, Repmd), __func__)) return;
  if (!SetExportChecked(env, exports, "repmf", Napi::Function::New(env, Repmf), __func__)) return;
  if (!SetExportChecked(env, exports, "repmi", Napi::Function::New(env, Repmi), __func__)) return;
  if (!SetExportChecked(env, exports, "repml", Napi::Function::New(env, Repml), __func__)) return;
  if (!SetExportChecked(env, exports, "repmot", Napi::Function::New(env, Repmot), __func__)) return;
  if (!SetExportChecked(env, exports, "cmprss", Napi::Function::New(env, Cmprss), __func__)) return;
  if (!SetExportChecked(env, exports, "eqstr", Napi::Function::New(env, Eqstr), __func__)) return;
  if (!SetExportChecked(env, exports, "iswhsp", Napi::Function::New(env, Iswhsp), __func__)) return;
  if (!SetExportChecked(env, exports, "lastnb", Napi::Function::New(env, Lastnb), __func__)) return;
  if (!SetExportChecked(env, exports, "lcase", Napi::Function::New(env, Lcase), __func__)) return;
  if (!SetExportChecked(env, exports, "ucase", Napi::Function::New(env, Ucase), __func__)) return;
  if (!SetExportChecked(env, exports, "matchi", Napi::Function::New(env, Matchi), __func__)) return;
  if (!SetExportChecked(env, exports, "matchw", Napi::Function::New(env, Matchw), __func__)) return;
}

}  // namespace tspice_backend_node
