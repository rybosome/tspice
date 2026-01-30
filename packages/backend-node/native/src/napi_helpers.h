#pragma once

#include <napi.h>

#include <string>
#include <type_traits>

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
  if (key == nullptr || key[0] == '\0') {
    ThrowSpiceError(env, "Internal error: attempted to export with a null/empty key");
    return false;
  }

  const char* safeKey = key;
  const char* safeContext = (context != nullptr) ? context : "<unknown>";

  bool has = false;
  const napi_status status = napi_has_named_property(env, exports, safeKey, &has);
  if (status != napi_ok) {
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

} // namespace tspice_napi
