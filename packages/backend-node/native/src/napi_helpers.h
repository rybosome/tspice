#pragma once

#include <napi.h>

#include <string>
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

inline void ThrowSpiceError(Napi::Env env, const std::string& context, const char* err) {
  std::string message = (err && err[0] != '\0') ? std::string(err) : "Unknown CSPICE error";
  if (!context.empty()) {
    message = context + ":\n" + message;
  }
  ThrowSpiceError(env, message);
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

  // NOTE: we intentionally keep capacity between calls (clear() does not shrink).
  // These helpers are often called in hot paths and reusing allocations reduces churn.
  out->values.clear();
  out->ptrs.clear();

  Napi::Array arr = value.As<Napi::Array>();
  const uint32_t len = arr.Length();

  if (len == 0) {
    return true;
  }

  // Perf note: `arr.Get(i)` crosses the N-API boundary, so keep the loop single-pass
  // and avoid any extra `Get()`/conversion work.
  //
  // Also: `ptrs` points into `values`, so we must reserve upfront to prevent vector reallocation
  // invalidating stored pointers.
  out->values.reserve(len);
  out->ptrs.reserve(len);

  for (uint32_t i = 0; i < len; i++) {
    const Napi::Value v = arr.Get(i);
    if (!v.IsString()) {
      ThrowSpiceError(
          Napi::TypeError::New(env, std::string(safeName) + " must contain only strings"));
      return false;
    }

    out->values.emplace_back(v.As<Napi::String>().Utf8Value());
    out->ptrs.push_back(out->values.back().c_str());
  }

  return true;
}

} // namespace tspice_napi
