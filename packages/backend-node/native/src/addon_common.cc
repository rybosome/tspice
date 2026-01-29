#include "addon_common.h"

#include <string>

#include "napi_helpers.h"

std::mutex g_cspice_mutex;

using tspice_napi::ThrowSpiceError;

bool ReadNumberArrayFixed(
    Napi::Env env,
    const Napi::Value& value,
    size_t expectedLength,
    double* out,
    const char* name) {
  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(name) + " must be an array"));
    return false;
  }

  Napi::Array arr = value.As<Napi::Array>();
  if (arr.Length() != expectedLength) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        std::string(name) + " must have length " + std::to_string(expectedLength)));
    return false;
  }

  for (uint32_t i = 0; i < expectedLength; i++) {
    const Napi::Value v = arr.Get(i);
    if (!v.IsNumber()) {
      ThrowSpiceError(
          Napi::TypeError::New(env, std::string(name) + " must contain only numbers"));
      return false;
    }
    out[i] = v.As<Napi::Number>().DoubleValue();
  }

  return true;
}

bool ReadVec3(Napi::Env env, const Napi::Value& value, double out[3], const char* name) {
  return ReadNumberArrayFixed(env, value, 3, out, name);
}

bool ReadMat33RowMajor(
    Napi::Env env,
    const Napi::Value& value,
    double out[9],
    const char* name) {
  return ReadNumberArrayFixed(env, value, 9, out, name);
}
