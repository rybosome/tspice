#include "strings.h"
#include "../cell_handles.h"
#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>
#include <memory>
#include <new>
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

static Napi::Value StringBytes(Napi::Env env, const char* data, size_t capacity) {
  const auto end = std::find(data, data + capacity, '\0');
  if (end == data + capacity) {
    ThrowSpiceError(Napi::Error::New(env, "CSPICE string result has no NUL terminator"));
    return env.Undefined();
  }
  const size_t length = static_cast<size_t>(end - data);
  const auto result = Napi::String::New(env, data, length);
  // N-API decodes invalid UTF-8 with replacement. A round trip must preserve
  // every byte, including a leading BOM and trailing whitespace.
  const std::string decoded = result.Utf8Value();
  if (decoded.size() != length || std::memcmp(decoded.data(), data, length) != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "CSPICE string result is not valid UTF-8"));
    return env.Undefined();
  }
  return result;
}

static Napi::Value StringResult(Napi::Env env, const std::vector<char>& out) {
  return StringBytes(env, out.data(), out.size());
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


static bool TokenInput(Napi::Env env, const Napi::Value& input, std::string* out) {
  if (!ReadText(env, input, out)) return false;
  if (out->size() <= static_cast<size_t>(std::numeric_limits<int>::max()-2)) return true;
  ThrowSpiceError(Napi::RangeError::New(env, "Input exceeds token cursor range"));
  return false;
}

static int TokenCapacity(size_t bytes, int requested) {
  return std::min(requested, std::max(2, static_cast<int>(bytes) + 1));
}

static std::unique_ptr<char[]> TokenBuffer(Napi::Env env, size_t size) {
  auto bytes = std::unique_ptr<char[]>(new (std::nothrow) char[size]());
  if (!bytes) ThrowSpiceError(Napi::RangeError::New(env, "Could not allocate token output"));
  return bytes;
}

static Napi::Value Nextwd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "nextwd() expects 3 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!TokenInput(env, info[0], &input)) return env.Undefined();
  int nexlen, reslen;
  if (!ReadInt(env, info[1], &nexlen) || !ReadInt(env, info[2], &reslen)) return env.Undefined();
  nexlen = TokenCapacity(input.size(), nexlen);
  reslen = TokenCapacity(input.size(), reslen);
  auto next = TokenBuffer(env, std::max(1, nexlen));
  if (!next) return env.Undefined();
  auto rest = TokenBuffer(env, std::max(1, reslen));
  if (!rest) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_nextwd(input.c_str(), nexlen, reslen, next.get(), rest.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling nextwd", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  auto nextValue = StringBytes(env, next.get(), nexlen);
  if (env.IsExceptionPending()) return env.Undefined();
  result.Set("next", nextValue);
  auto restValue = StringBytes(env, rest.get(), reslen);
  if (env.IsExceptionPending()) return env.Undefined();
  result.Set("rest", restValue);
  return result;
}

static Napi::Value Nthwd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "nthwd() expects 3 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!TokenInput(env, info[0], &input)) return env.Undefined();
  int nth, worlen, loc = -1;
  if (!ReadInt(env, info[1], &nth) || !ReadInt(env, info[2], &worlen)) return env.Undefined();
  worlen = TokenCapacity(input.size(), worlen);
  auto word = TokenBuffer(env, std::max(1, worlen));
  if (!word) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_nthwd(input.c_str(), nth, worlen, word.get(), &loc, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling nthwd", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  auto wordValue = StringBytes(env, word.get(), worlen);
  if (env.IsExceptionPending()) return env.Undefined();
  result.Set("word", wordValue);
  result.Set("loc", loc);
  return result;
}

static Napi::Value Lparse(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "lparse() expects 4 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!TokenInput(env, info[0], &input)) return env.Undefined();
  std::string delimiters;
  int nmax, itemln, n = 0;
  if (!ReadText(env, info[1], &delimiters) || !ReadInt(env, info[2], &nmax) ||
      !ReadInt(env, info[3], &itemln)) return env.Undefined();
  nmax = std::min(nmax, static_cast<int>(input.size()) + 1);
  itemln = TokenCapacity(input.size(), itemln);
  const int64_t bytes = nmax > 0 && itemln >= 2 ? static_cast<int64_t>(nmax) * itemln : 1;
  if (bytes > 256LL * 1024 * 1024) {
    ThrowSpiceError(Napi::RangeError::New(env, "Token table exceeds 256 MiB"));
    return env.Undefined();
  }
  auto items = TokenBuffer(env, static_cast<size_t>(bytes));
  if (!items) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_lparse(input.c_str(), delimiters.c_str(), nmax, itemln, &n, items.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling lparse", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  if (n < 0 || n > std::max(0, nmax)) {
    ThrowSpiceError(Napi::Error::New(env, "Invalid returned token count"));
    return env.Undefined();
  }
  Napi::Array strings = Napi::Array::New(env, n);
  for (int i = 0; i < n; ++i) {
    auto text = StringBytes(env, items.get() + static_cast<size_t>(i) * itemln, itemln);
    if (env.IsExceptionPending()) return env.Undefined();
    strings.Set(static_cast<uint32_t>(i), text);
  }
  result.Set("n", n);
  result.Set("items", strings);
  return result;
}

static Napi::Value Lparsm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "lparsm() expects 4 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!TokenInput(env, info[0], &input)) return env.Undefined();
  std::string delimiters;
  int nmax, itemln, n = 0;
  if (!ReadText(env, info[1], &delimiters) || !ReadInt(env, info[2], &nmax) ||
      !ReadInt(env, info[3], &itemln)) return env.Undefined();
  nmax = std::min(nmax, static_cast<int>(input.size()) + 1);
  itemln = TokenCapacity(input.size(), itemln);
  const int64_t bytes = nmax > 0 && itemln >= 2 ? static_cast<int64_t>(nmax) * itemln : 1;
  if (bytes > 256LL * 1024 * 1024) {
    ThrowSpiceError(Napi::RangeError::New(env, "Token table exceeds 256 MiB"));
    return env.Undefined();
  }
  auto items = TokenBuffer(env, static_cast<size_t>(bytes));
  if (!items) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_lparsm(input.c_str(), delimiters.c_str(), nmax, itemln, &n, items.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling lparsm", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  if (n < 0 || n > std::max(0, nmax)) {
    ThrowSpiceError(Napi::Error::New(env, "Invalid returned token count"));
    return env.Undefined();
  }
  Napi::Array strings = Napi::Array::New(env, n);
  for (int i = 0; i < n; ++i) {
    auto text = StringBytes(env, items.get() + static_cast<size_t>(i) * itemln, itemln);
    if (env.IsExceptionPending()) return env.Undefined();
    strings.Set(static_cast<uint32_t>(i), text);
  }
  result.Set("n", n);
  result.Set("items", strings);
  return result;
}

static Napi::Value Lx4dec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "lx4dec() expects 2 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!TokenInput(env, info[0], &input)) return env.Undefined();
  int first;
  if (!ReadInt(env, info[1], &first)) return env.Undefined();
  double last = 0;
  int nchar = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_lx4dec(input.c_str(), first, &last, &nchar, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling lx4dec", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("last", last);
  result.Set("nchar", nchar);
  return result;
}

static Napi::Value Lx4num(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "lx4num() expects 2 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!TokenInput(env, info[0], &input)) return env.Undefined();
  int first;
  if (!ReadInt(env, info[1], &first)) return env.Undefined();
  double last = 0;
  int nchar = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_lx4num(input.c_str(), first, &last, &nchar, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling lx4num", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("last", last);
  result.Set("nchar", nchar);
  return result;
}

static Napi::Value Lx4sgn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "lx4sgn() expects 2 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!TokenInput(env, info[0], &input)) return env.Undefined();
  int first;
  if (!ReadInt(env, info[1], &first)) return env.Undefined();
  double last = 0;
  int nchar = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_lx4sgn(input.c_str(), first, &last, &nchar, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling lx4sgn", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("last", last);
  result.Set("nchar", nchar);
  return result;
}

static Napi::Value Lx4uns(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "lx4uns() expects 2 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!TokenInput(env, info[0], &input)) return env.Undefined();
  int first;
  if (!ReadInt(env, info[1], &first)) return env.Undefined();
  double last = 0;
  int nchar = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_lx4uns(input.c_str(), first, &last, &nchar, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling lx4uns", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("last", last);
  result.Set("nchar", nchar);
  return result;
}

static Napi::Value Lxqstr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "lxqstr() expects 3 arguments"));
    return env.Undefined();
  }
  std::string input;
  if (!TokenInput(env, info[0], &input)) return env.Undefined();
  int qchar;
  if (!ReadChar(env, info[1], &qchar)) return env.Undefined();
  int first;
  if (!ReadInt(env, info[2], &first)) return env.Undefined();
  double last = 0;
  int nchar = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_lxqstr(input.c_str(), qchar, first, &last, &nchar, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling lxqstr", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("last", last);
  result.Set("nchar", nchar);
  return result;
}

static Napi::Value Lparss(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "lparss expects list, delims and a character cell"));
    return env.Undefined();
  }
  std::string list, delims;
  uint32_t handle = 0;
  if (!ReadText(env, info[0], &list) || !ReadText(env, info[1], &delims) ||
      !tspice_backend_node::ReadCellHandleArg(env, info[2], "set", &handle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t set = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_CHR, "lparss", "set");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_lparss(list.c_str(), delims.c_str(), set, err, sizeof(err)))
    ThrowSpiceError(env, "CSPICE failed while calling lparss", err);
  return env.Undefined();
}

namespace tspice_backend_node {

void RegisterStrings(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "nextwd", Napi::Function::New(env, Nextwd), __func__)) return;
  if (!SetExportChecked(env, exports, "nthwd", Napi::Function::New(env, Nthwd), __func__)) return;
  if (!SetExportChecked(env, exports, "lparse", Napi::Function::New(env, Lparse), __func__)) return;
  if (!SetExportChecked(env, exports, "lparss", Napi::Function::New(env, Lparss), __func__)) return;
  if (!SetExportChecked(env, exports, "lparsm", Napi::Function::New(env, Lparsm), __func__)) return;
  if (!SetExportChecked(env, exports, "lx4dec", Napi::Function::New(env, Lx4dec), __func__)) return;
  if (!SetExportChecked(env, exports, "lx4num", Napi::Function::New(env, Lx4num), __func__)) return;
  if (!SetExportChecked(env, exports, "lx4sgn", Napi::Function::New(env, Lx4sgn), __func__)) return;
  if (!SetExportChecked(env, exports, "lx4uns", Napi::Function::New(env, Lx4uns), __func__)) return;
  if (!SetExportChecked(env, exports, "lxqstr", Napi::Function::New(env, Lxqstr), __func__)) return;
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
