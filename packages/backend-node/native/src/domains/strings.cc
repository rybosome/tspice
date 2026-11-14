#include "strings.h"
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


static bool ReadPositionArgs(const Napi::CallbackInfo& info, std::string* text,
                             std::string* needle, int* start) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected text, search string and start"));
    return false;
  }
  return ReadText(env, info[0], text) && ReadText(env, info[1], needle) && ReadInt(env, info[2], start);
}

static Napi::Value Cpos(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  std::string text, chars;
  int start = 0;
  if (!ReadPositionArgs(info, &text, &chars, &start)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_cpos(text.c_str(), chars.c_str(), start, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling cpos", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Cposr(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  std::string text, chars;
  int start = 0;
  if (!ReadPositionArgs(info, &text, &chars, &start)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_cposr(text.c_str(), chars.c_str(), start, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling cposr", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Ncpos(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  std::string text, chars;
  int start = 0;
  if (!ReadPositionArgs(info, &text, &chars, &start)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_ncpos(text.c_str(), chars.c_str(), start, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ncpos", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Ncposr(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  std::string text, chars;
  int start = 0;
  if (!ReadPositionArgs(info, &text, &chars, &start)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_ncposr(text.c_str(), chars.c_str(), start, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ncposr", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Pos(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  std::string text, substr;
  int start = 0;
  if (!ReadPositionArgs(info, &text, &substr, &start)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_pos(text.c_str(), substr.c_str(), start, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling pos", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Posr(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  std::string text, substr;
  int start = 0;
  if (!ReadPositionArgs(info, &text, &substr, &start)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_posr(text.c_str(), substr.c_str(), start, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling posr", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Esrchc(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[1].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "esrchc() expects a string and an array of strings"));
    return env.Undefined();
  }
  std::string key;
  if (!ReadText(env, info[0], &key)) return env.Undefined();
  const Napi::Array values = info[1].As<Napi::Array>();
  const uint32_t length = values.Length();
  const int maximum = std::numeric_limits<int>::max();
  if (length > static_cast<uint32_t>(maximum / 2)) {
    ThrowSpiceError(Napi::RangeError::New(env, "esrchc row table exceeds signed32 indexing"));
    return env.Undefined();
  }
  const int count = static_cast<int>(length);
  const int maxWidth = maximum / std::max(1, count);
  // Read each caller property once, before allocating the rectangular table.
  // Grow only after validating an entry, so a large sparse array fails early.
  std::vector<std::string> snapshot;
  int width = 2;
  for (int i = 0; i < count; i++) {
    Napi::HandleScope scope(env);
    const Napi::Value item = values.Get(static_cast<uint32_t>(i));
    std::string text;
    if (env.IsExceptionPending() || !ReadText(env, item, &text, static_cast<size_t>(maxWidth - 1)))
      return env.Undefined();
    width = std::max(width, static_cast<int>(text.size()) + 1);
    snapshot.push_back(std::move(text));
  }
  const size_t size = static_cast<size_t>(std::max(1, count * width));
  std::unique_ptr<char[]> rows(new (std::nothrow) char[size]());
  if (!rows) {
    ThrowSpiceError(Napi::Error::New(env, "Could not allocate esrchc row table"));
    return env.Undefined();
  }
  for (int i = 0; i < count; i++)
    std::memcpy(rows.get() + i * width, snapshot[i].data(), snapshot[i].size());
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_esrchc(key.c_str(), count, width, rows.get(), &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling esrchc", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

namespace tspice_backend_node {

void RegisterStrings(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "cpos", Napi::Function::New(env, Cpos), __func__)) return;
  if (!SetExportChecked(env, exports, "cposr", Napi::Function::New(env, Cposr), __func__)) return;
  if (!SetExportChecked(env, exports, "ncpos", Napi::Function::New(env, Ncpos), __func__)) return;
  if (!SetExportChecked(env, exports, "ncposr", Napi::Function::New(env, Ncposr), __func__)) return;
  if (!SetExportChecked(env, exports, "pos", Napi::Function::New(env, Pos), __func__)) return;
  if (!SetExportChecked(env, exports, "posr", Napi::Function::New(env, Posr), __func__)) return;
  if (!SetExportChecked(env, exports, "esrchc", Napi::Function::New(env, Esrchc), __func__)) return;
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
