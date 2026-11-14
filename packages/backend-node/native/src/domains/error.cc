#include "error.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>
#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

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

static Napi::Value Errch(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "errch expects 2 arguments"));
    return env.Undefined();
  }
  std::string marker;
  if (!ReadText(env, info[0], &marker)) return env.Undefined();
  std::string value;
  if (!ReadText(env, info[1], &value)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_errch(marker.c_str(), value.c_str(), err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "errch", err, "errch");
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Errdp(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "errdp expects 2 arguments"));
    return env.Undefined();
  }
  std::string marker;
  if (!ReadText(env, info[0], &marker)) return env.Undefined();
  if (!info[1].IsNumber() || !std::isfinite(info[1].As<Napi::Number>().DoubleValue())) {
    ThrowSpiceError(Napi::TypeError::New(env, "errdp expects a finite number"));
    return env.Undefined();
  }
  const double value = info[1].As<Napi::Number>().DoubleValue();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_errdp(marker.c_str(), value, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "errdp", err, "errdp");
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Errint(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "errint expects 2 arguments"));
    return env.Undefined();
  }
  std::string marker;
  if (!ReadText(env, info[0], &marker)) return env.Undefined();
  int value;
  if (!ReadInt(env, info[1], &value)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_errint(marker.c_str(), value, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "errint", err, "errint");
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Qcktrc(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "qcktrc expects 1 arguments"));
    return env.Undefined();
  }
  int capacity;
  if (!ReadInt(env, info[0], &capacity)) return env.Undefined();
  char out[4096] = {};
  capacity = std::min(capacity, static_cast<int>(sizeof(out)));
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_qcktrc(capacity, out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "qcktrc", err, "qcktrc");
    return env.Undefined();
  }
  return StringBytes(env, out, sizeof(out));
}

static Napi::Value Return(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "return expects 0 arguments"));
    return env.Undefined();
  }
  int out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_return(&out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "return", err, "return");
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Trcdep(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "trcdep expects 0 arguments"));
    return env.Undefined();
  }
  int out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_trcdep(&out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "trcdep", err, "trcdep");
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Trcnam(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "trcnam expects 2 arguments"));
    return env.Undefined();
  }
  int index;
  if (!ReadInt(env, info[0], &index)) return env.Undefined();
  int capacity;
  if (!ReadInt(env, info[1], &capacity)) return env.Undefined();
  char out[33] = {};
  capacity = std::min(capacity, static_cast<int>(sizeof(out)));
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_trcnam(index, capacity, out, err, sizeof(err)) != 0) {
    ThrowSpiceError(env, "trcnam", err, "trcnam");
    return env.Undefined();
  }
  return StringBytes(env, out, sizeof(out));
}

static Napi::Boolean Failed(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "failed() does not take any arguments"));
    return Napi::Boolean::New(env, false);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  int outFailed = 0;
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_failed(&outFailed, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling failed()", err);
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, outFailed != 0);
}

static void Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "reset() does not take any arguments"));
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_reset(err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling reset()", err);
  }
}

static Napi::String Getmsg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "getmsg(which: 'SHORT' | 'LONG' | 'EXPLAIN') expects exactly one string argument"));
    return Napi::String::New(env, "");
  }

  const std::string which = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char out[tspice_backend_node::kOutMaxBytes];
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_getmsg(which.c_str(), out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling getmsg", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static void Setmsg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "setmsg(message: string) expects exactly one string argument"));
    return;
  }

  const std::string msg = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_setmsg(msg.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling setmsg", err);
  }
}

static void Sigerr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sigerr(short: string) expects exactly one string argument"));
    return;
  }

  const std::string shortMsg = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_sigerr(shortMsg.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sigerr", err);
  }
}

static void Chkin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "chkin(name: string) expects exactly one string argument"));
    return;
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_chkin(name.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling chkin", err);
  }
}

static void Chkout(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "chkout(name: string) expects exactly one string argument"));
    return;
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_chkout(name.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling chkout", err);
  }
}

namespace tspice_backend_node {

void RegisterError(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "errch", Napi::Function::New(env, Errch), __func__)) return;
  if (!SetExportChecked(env, exports, "errdp", Napi::Function::New(env, Errdp), __func__)) return;
  if (!SetExportChecked(env, exports, "errint", Napi::Function::New(env, Errint), __func__)) return;
  if (!SetExportChecked(env, exports, "qcktrc", Napi::Function::New(env, Qcktrc), __func__)) return;
  if (!SetExportChecked(env, exports, "return", Napi::Function::New(env, Return), __func__)) return;
  if (!SetExportChecked(env, exports, "trcdep", Napi::Function::New(env, Trcdep), __func__)) return;
  if (!SetExportChecked(env, exports, "trcnam", Napi::Function::New(env, Trcnam), __func__)) return;
  if (!SetExportChecked(env, exports, "failed", Napi::Function::New(env, Failed), __func__)) return;
  if (!SetExportChecked(env, exports, "reset", Napi::Function::New(env, Reset), __func__)) return;
  if (!SetExportChecked(env, exports, "getmsg", Napi::Function::New(env, Getmsg), __func__)) return;
  if (!SetExportChecked(env, exports, "setmsg", Napi::Function::New(env, Setmsg), __func__)) return;
  if (!SetExportChecked(env, exports, "sigerr", Napi::Function::New(env, Sigerr), __func__)) return;
  if (!SetExportChecked(env, exports, "chkin", Napi::Function::New(env, Chkin), __func__)) return;
  if (!SetExportChecked(env, exports, "chkout", Napi::Function::New(env, Chkout), __func__)) return;
}

}  // namespace tspice_backend_node
