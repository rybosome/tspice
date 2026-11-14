#include "time.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <limits>
#include <memory>
#include <new>
#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::SetExportChecked;
using tspice_napi::PreviewForError;
using tspice_napi::ThrowSpiceError;

static bool ReadClockText(Napi::Env env, const Napi::Value& value, std::string* text) {
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

static bool ReadClockInt(Napi::Env env, const Napi::Value& value, int* out) {
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

static Napi::Value Sce2t(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "sce2t() expects 2 arguments"));
    return env.Undefined();
  }
  int sc = 0;
  if (!ReadClockInt(env, info[0], &sc)) return env.Undefined();
  if (sc == INT32_MIN) {
    ThrowSpiceError(Napi::RangeError::New(env, "Clock ID cannot be negated as a SpiceInt"));
    return env.Undefined();
  }
  if (!info[1].IsNumber() || !std::isfinite(info[1].As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a finite clock value"));
    return env.Undefined();
  }
  const double value = info[1].As<Napi::Number>().DoubleValue();
  double out = 0.0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_sce2t(sc, value, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sce2t", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Scfmt(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "scfmt() expects 3 arguments"));
    return env.Undefined();
  }
  int sc = 0;
  if (!ReadClockInt(env, info[0], &sc)) return env.Undefined();
  if (sc == INT32_MIN) {
    ThrowSpiceError(Napi::RangeError::New(env, "Clock ID cannot be negated as a SpiceInt"));
    return env.Undefined();
  }
  if (!info[1].IsNumber() || !std::isfinite(info[1].As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a finite clock value"));
    return env.Undefined();
  }
  const double value = info[1].As<Napi::Number>().DoubleValue();
  int clklen = 0;
  if (!ReadClockInt(env, info[2], &clklen)) return env.Undefined();
  clklen = std::min(clklen, TSPICE_SCLK_FORMAT_MAX_BYTES);
  char out[TSPICE_SCLK_FORMAT_MAX_BYTES] = {};
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_scfmt(sc, value, clklen, out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling scfmt", err);
    return env.Undefined();
  }
  const char* end = std::find(out, out + std::max(1, clklen), '\0');
  if (end == out + std::max(1, clklen)) {
    ThrowSpiceError(Napi::Error::New(env, "Missing clock string terminator"));
    return env.Undefined();
  }
  return Napi::String::New(env, out, static_cast<size_t>(end - out));
}

static Napi::Value Scpart(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "scpart() expects 1 arguments"));
    return env.Undefined();
  }
  int sc = 0;
  if (!ReadClockInt(env, info[0], &sc)) return env.Undefined();
  if (sc == INT32_MIN) {
    ThrowSpiceError(Napi::RangeError::New(env, "Clock ID cannot be negated as a SpiceInt"));
    return env.Undefined();
  }
  auto start = std::unique_ptr<double[]>(new (std::nothrow) double[TSPICE_SCLK_MAX_PARTITIONS]);
  auto stop = std::unique_ptr<double[]>(new (std::nothrow) double[TSPICE_SCLK_MAX_PARTITIONS]);
  if (!start || !stop) {
    ThrowSpiceError(Napi::Error::New(env, "Clock partition buffer allocation failed"));
    return env.Undefined();
  }
  int count = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_scpart(sc, TSPICE_SCLK_MAX_PARTITIONS, &count, start.get(), stop.get(), err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling scpart", err);
    return env.Undefined();
  }
  Napi::Object result = Napi::Object::New(env);
  result.Set("pstart", tspice_napi::MakeNumberArray(env, start.get(), static_cast<size_t>(count)));
  result.Set("pstop", tspice_napi::MakeNumberArray(env, stop.get(), static_cast<size_t>(count)));
  return result;
}

static Napi::Value Sctiks(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "sctiks() expects 2 arguments"));
    return env.Undefined();
  }
  int sc = 0;
  if (!ReadClockInt(env, info[0], &sc)) return env.Undefined();
  if (sc == INT32_MIN) {
    ThrowSpiceError(Napi::RangeError::New(env, "Clock ID cannot be negated as a SpiceInt"));
    return env.Undefined();
  }
  std::string text;
  if (!ReadClockText(env, info[1], &text)) return env.Undefined();
  double out = 0.0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_sctiks(sc, text.c_str(), &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sctiks", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Number Str2et(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "str2et(time: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string time = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  double et = 0.0;
  const int code = tspice_str2et(time.c_str(), &et, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling str2et(\"") + PreviewForError(time) + "\")",
        err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::String Et2utc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsString() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "et2utc(et: number, format: string, prec: number) expects (number, string, number)"));
    return Napi::String::New(env, "");
  }

  const double et = info[0].As<Napi::Number>().DoubleValue();
  const std::string format = info[1].As<Napi::String>().Utf8Value();
  const int prec = info[2].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code =
      tspice_et2utc(et, format.c_str(), prec, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling et2utc", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::String Timout(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "timout(et: number, picture: string) expects (number, string)"));
    return Napi::String::New(env, "");
  }

  const double et = info[0].As<Napi::Number>().DoubleValue();
  const std::string picture = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code = tspice_timout(et, picture.c_str(), out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling timout", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::Number Deltet(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "deltet(epoch: number, eptype: string) expects (number, string)"));
    return Napi::Number::New(env, 0);
  }

  const double epoch = info[0].As<Napi::Number>().DoubleValue();
  const std::string eptype = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double delta = 0.0;
  const int code = tspice_deltet(epoch, eptype.c_str(), &delta, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling deltet", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, delta);
}

static Napi::Number Unitim(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsString() || !info[2].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "unitim(epoch: number, insys: string, outsys: string) expects (number, string, string)"));
    return Napi::Number::New(env, 0);
  }

  const double epoch = info[0].As<Napi::Number>().DoubleValue();
  const std::string insys = info[1].As<Napi::String>().Utf8Value();
  const std::string outsys = info[2].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double outEpoch = 0.0;
  const int code =
      tspice_unitim(epoch, insys.c_str(), outsys.c_str(), &outEpoch, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling unitim", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, outEpoch);
}

static Napi::Number Tparse(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "tparse(timstr: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string timstr = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double et = 0.0;
  const int code = tspice_tparse(timstr.c_str(), &et, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling tparse(\"") + PreviewForError(timstr) + "\")",
        err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::String Tpictr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "tpictr(sample: string, pictur: string) expects exactly two string arguments"));
    return Napi::String::New(env, "");
  }

  const std::string sample = info[0].As<Napi::String>().Utf8Value();
  const std::string picturIn = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code =
      tspice_tpictr(sample.c_str(), picturIn.c_str(), out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling tpictr", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::String TimdefGet(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "timdefGet(item: string) expects exactly one string argument"));
    return Napi::String::New(env, "");
  }

  const std::string item = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code = tspice_timdef_get(item.c_str(), out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling timdef(GET)", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static void TimdefSet(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "timdefSet(item: string, value: string) expects (string, string)"));
    return;
  }

  const std::string item = info[0].As<Napi::String>().Utf8Value();
  const std::string value = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_timdef_set(item.c_str(), value.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling timdef(SET)", err);
  }
}

static Napi::Number Scs2e(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "scs2e(sc: number, sclkch: string) expects (number, string)"));
    return Napi::Number::New(env, 0);
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const std::string sclkch = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double et = 0.0;
  const int code = tspice_scs2e(sc, sclkch.c_str(), &et, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling scs2e", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::String Sce2s(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sce2s(sc: number, et: number) expects (number, number)"));
    return Napi::String::New(env, "");
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code = tspice_sce2s(sc, et, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sce2s", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::Number Scencd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "scencd(sc: number, sclkch: string) expects (number, string)"));
    return Napi::Number::New(env, 0);
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const std::string sclkch = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double sclkdp = 0.0;
  const int code = tspice_scencd(sc, sclkch.c_str(), &sclkdp, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling scencd", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, sclkdp);
}

static Napi::String Scdecd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "scdecd(sc: number, sclkdp: number) expects (number, number)"));
    return Napi::String::New(env, "");
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const double sclkdp = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code = tspice_scdecd(sc, sclkdp, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling scdecd", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::Number Sct2e(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sct2e(sc: number, sclkdp: number) expects (number, number)"));
    return Napi::Number::New(env, 0);
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const double sclkdp = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double et = 0.0;
  const int code = tspice_sct2e(sc, sclkdp, &et, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sct2e", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::Number Sce2c(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sce2c(sc: number, et: number) expects (number, number)"));
    return Napi::Number::New(env, 0);
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double sclkdp = 0.0;
  const int code = tspice_sce2c(sc, et, &sclkdp, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sce2c", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, sclkdp);
}

namespace tspice_backend_node {

void RegisterTime(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "str2et", Napi::Function::New(env, Str2et), __func__)) return;
  if (!SetExportChecked(env, exports, "et2utc", Napi::Function::New(env, Et2utc), __func__)) return;
  if (!SetExportChecked(env, exports, "timout", Napi::Function::New(env, Timout), __func__)) return;

  if (!SetExportChecked(env, exports, "deltet", Napi::Function::New(env, Deltet), __func__)) return;
  if (!SetExportChecked(env, exports, "unitim", Napi::Function::New(env, Unitim), __func__)) return;
  if (!SetExportChecked(env, exports, "tparse", Napi::Function::New(env, Tparse), __func__)) return;
  if (!SetExportChecked(env, exports, "tpictr", Napi::Function::New(env, Tpictr), __func__)) return;
  if (!SetExportChecked(env, exports, "timdefGet", Napi::Function::New(env, TimdefGet), __func__)) return;
  if (!SetExportChecked(env, exports, "timdefSet", Napi::Function::New(env, TimdefSet), __func__)) return;

  if (!SetExportChecked(env, exports, "scs2e", Napi::Function::New(env, Scs2e), __func__)) return;
  if (!SetExportChecked(env, exports, "sce2t", Napi::Function::New(env, Sce2t), __func__)) return;
  if (!SetExportChecked(env, exports, "scfmt", Napi::Function::New(env, Scfmt), __func__)) return;
  if (!SetExportChecked(env, exports, "scpart", Napi::Function::New(env, Scpart), __func__)) return;
  if (!SetExportChecked(env, exports, "sctiks", Napi::Function::New(env, Sctiks), __func__)) return;
  if (!SetExportChecked(env, exports, "sce2s", Napi::Function::New(env, Sce2s), __func__)) return;
  if (!SetExportChecked(env, exports, "scencd", Napi::Function::New(env, Scencd), __func__)) return;
  if (!SetExportChecked(env, exports, "scdecd", Napi::Function::New(env, Scdecd), __func__)) return;
  if (!SetExportChecked(env, exports, "sct2e", Napi::Function::New(env, Sct2e), __func__)) return;
  if (!SetExportChecked(env, exports, "sce2c", Napi::Function::New(env, Sce2c), __func__)) return;
}

}  // namespace tspice_backend_node
