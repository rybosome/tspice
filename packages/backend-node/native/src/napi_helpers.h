#pragma once

#include <napi.h>

#include "tspice_backend_shim.h"

#include <functional>
#include <string>
#include <string_view>
#include <type_traits>
#include <vector>

namespace tspice_napi {

inline void ThrowSpiceError(const Napi::Error& err) {
  err.ThrowAsJavaScriptException();
}

inline void ThrowSpiceError(Napi::Env env, const std::string& message) {
  ThrowSpiceError(Napi::Error::New(env, message));
}

inline void ThrowSpiceError(Napi::Env env, const char* message) {
  ThrowSpiceError(env, std::string(message ? message : ""));
}

inline void ThrowSpiceError(
    Napi::Env env,
    const std::string& context,
    const char* err,
    const char* spiceOp = nullptr,
    std::function<void(Napi::Object&)> attachContext = {}) {
  // This overload is used for CSPICE-signaled failures, where the C shim has
  // already captured/cleared SPICE error status and produced an error message.
  std::string message = (err && err[0] != '\0') ? std::string(err) : "Unknown CSPICE error";
  if (!context.empty()) {
    message = context + ":\n" + message;
  }

  Napi::Error jsErr = Napi::Error::New(env, message);
  Napi::Object obj = jsErr.Value().As<Napi::Object>();

  // Attach structured context about the CSPICE operation, without changing the
  // existing error message format.
  if (spiceOp != nullptr && spiceOp[0] != '\0') {
    obj.Set("spiceOp", Napi::String::New(env, spiceOp));
  }
  if (attachContext) {
    attachContext(obj);
  }

  // Attach structured SPICE error details when they appear to correspond to
  // this error.
  //
  // The C shim stores SPICE fields out-of-band, so for non-CSPICE validation
  // errors we must avoid accidentally attaching stale fields from a previous
  // CSPICE failure.
  char shortMsg[1841];
  char longMsg[1841];
  char traceMsg[1841];
  shortMsg[0] = '\0';
  longMsg[0] = '\0';
  traceMsg[0] = '\0';

  tspice_get_last_error_short(shortMsg, (int)sizeof(shortMsg));
  tspice_get_last_error_long(longMsg, (int)sizeof(longMsg));
  tspice_get_last_error_trace(traceMsg, (int)sizeof(traceMsg));

  const bool shouldAttachSpiceFields =
      (shortMsg[0] != '\0') && (message.find(shortMsg) != std::string::npos);

  if (shouldAttachSpiceFields) {
    if (shortMsg[0] != '\0') {
      obj.Set("spiceShort", Napi::String::New(env, shortMsg));
    }
    if (longMsg[0] != '\0') {
      obj.Set("spiceLong", Napi::String::New(env, longMsg));
    }
    if (traceMsg[0] != '\0') {
      obj.Set("spiceTrace", Napi::String::New(env, traceMsg));
    }
  }

  ThrowSpiceError(jsErr);
}

inline Napi::Array MakeNumberArray(Napi::Env env, const double* values, size_t count) {
  Napi::Array arr = Napi::Array::New(env, count);
  for (size_t i = 0; i < count; i++) {
    arr.Set(i, Napi::Number::New(env, values[i]));
  }
  return arr;
}

inline bool SetExportChecked(
    Napi::Env env,
    Napi::Object exports,
    const char* key,
    const Napi::Value& value,
    const char* context) {
  // If a JavaScript exception is already pending, avoid throwing a new one.
  // This lets callers preserve the original error context.
  if (env.IsExceptionPending()) {
    return false;
  }

  if (key == nullptr || key[0] == '\0') {
    ThrowSpiceError(env, "Internal error: attempted to export with a null/empty key");
    return false;
  }

  const char* safeKey = key;
  const char* safeContext = (context != nullptr) ? context : "<unknown>";

  bool has = false;
  const napi_status status = napi_has_named_property(env, exports, safeKey, &has);
  if (status != napi_ok) {
    // Some N-API calls can fail when an exception is pending; preserve it.
    if (env.IsExceptionPending()) {
      return false;
    }
    ThrowSpiceError(
        env,
        std::string("Internal error: failed while checking for existing export '") + safeKey +
            "' during " + safeContext);
    return false;
  }

  if (has) {
    ThrowSpiceError(
        env,
        std::string("Duplicate export key '") + safeKey +
            "' detected while registering " + safeContext);
    return false;
  }

  exports.Set(safeKey, value);
  return true;
}

template <class>
inline constexpr bool kAlwaysFalseV = false;

template <typename T>
inline Napi::Object MakeFound(Napi::Env env, const char* key, const T& value) {
  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));

  if constexpr (std::is_same_v<T, bool>) {
    result.Set(key, Napi::Boolean::New(env, value));
  } else if constexpr (std::is_arithmetic_v<T>) {
    result.Set(key, Napi::Number::New(env, static_cast<double>(value)));
  } else if constexpr (std::is_same_v<T, std::string>) {
    result.Set(key, Napi::String::New(env, value));
  } else if constexpr (std::is_same_v<T, const char*>) {
    result.Set(key, Napi::String::New(env, value));
  } else {
    static_assert(kAlwaysFalseV<T>, "Unsupported MakeFound<T>() value type");
  }

  return result;
}

inline Napi::Object MakeNotFound(Napi::Env env) {
  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, false));
  return result;
}

inline bool IsAsciiWhitespace(unsigned char c) {
  switch (c) {
    case ' ':
    case '\t':
    case '\n':
    case '\r':
    case '\f':
    case '\v':
      return true;
    default:
      return false;
  }
}

inline std::string TrimAsciiWhitespace(std::string_view s) {
  size_t start = 0;
  while (start < s.size() && IsAsciiWhitespace(static_cast<unsigned char>(s[start]))) {
    start++;
  }

  size_t end = s.size();
  while (end > start && IsAsciiWhitespace(static_cast<unsigned char>(s[end - 1]))) {
    end--;
  }

  return std::string(s.substr(start, end - start));
}

/**
 * Converts a CSPICE-style fixed-width output buffer to a JS string.
 *
 * - Reads at most `width` bytes.
 * - Stops at the first `\0` byte (embedded NUL terminates).
 * - Trims trailing ASCII whitespace bytes only (not Unicode-aware).
 *
 * This matches how many CSPICE APIs return fixed-width, space-padded buffers.
 */
inline Napi::String FixedWidthToJsString(Napi::Env env, const char* buf, size_t width) {
  if (buf == nullptr || width == 0) {
    return Napi::String::New(env, "");
  }

  size_t len = 0;
  for (; len < width; len++) {
    if (buf[len] == '\0') {
      break;
    }
  }

  std::string out(buf, len);
  while (!out.empty() && IsAsciiWhitespace(static_cast<unsigned char>(out.back()))) {
    out.pop_back();
  }

  return Napi::String::New(env, out);
}

/**
* Parsed JS `string[]` argument with stable `c_str()` pointers for the duration of the call.
*/
struct JsStringArrayArg {
  std::vector<std::string> values;
  std::vector<const char*> ptrs;
};

// Hard cap to defend against pathological sparse arrays with enormous `.length`
// values that would otherwise trigger massive native allocations.
inline constexpr uint32_t kMaxStringArrayLen = 1'000'000;

inline bool ReadStringArray(Napi::Env env, const Napi::Value& value, JsStringArrayArg* out, const char* name) {
  const char* safeName = (name != nullptr) ? name : "<unnamed>";

  if (out == nullptr) {
    ThrowSpiceError(
        Napi::Error::New(env, std::string("Internal error: out is null while reading ") + safeName));
    return false;
  }

  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(safeName) + " must be an array"));
    return false;
  }

  Napi::Array arr = value.As<Napi::Array>();
  const uint32_t len = arr.Length();

  if (len > kMaxStringArrayLen) {
    Napi::RangeError::New(
        env,
        std::string(safeName) + " is too long (length " + std::to_string(len) +
            "; max " + std::to_string(kMaxStringArrayLen) + ")")
        .ThrowAsJavaScriptException();
    return false;
  }

  // Build into locals so callers never observe a partially-filled `out` on failure.
  //
  // Pointer stability: we collect all strings first, then build `ptrs` in a second pass so each
  // `c_str()` pointer is taken only after the vector is fully populated.
  std::vector<std::string> values;
  std::vector<const char*> ptrs;
  values.reserve(len);

  for (uint32_t i = 0; i < len; i++) {
    const Napi::Value v = arr.Get(i);
    if (!v.IsString()) {
      ThrowSpiceError(
          Napi::TypeError::New(env, std::string(safeName) + " must contain only strings"));
      return false;
    }

    values.emplace_back(v.As<Napi::String>().Utf8Value());
  }

  ptrs.reserve(values.size());
  for (const std::string& s : values) {
    ptrs.push_back(s.c_str());
  }

  out->values.swap(values);
  out->ptrs.swap(ptrs);
  return true;
}

} // namespace tspice_napi
