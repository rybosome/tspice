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
