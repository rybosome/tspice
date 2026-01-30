#include "addon_common.h"

#include <limits>
#include <string>

#include "napi_helpers.h"

namespace tspice_backend_node {

std::mutex g_cspice_mutex;

using tspice_napi::ThrowSpiceError;

bool ReadNumberArrayFixed(
    Napi::Env env,
    const Napi::Value& value,
    size_t expectedLength,
    double* out,
    const char* name) {
  const char* safeName = (name != nullptr) ? name : "<unnamed>";

  if (out == nullptr) {
    ThrowSpiceError(
        Napi::Error::New(env, std::string("Internal error: out is null while reading ") + safeName));
    return false;
  }

  if (expectedLength == 0) {
    ThrowSpiceError(Napi::Error::New(
        env,
        std::string("Internal error: expectedLength is 0 while reading ") + safeName));
    return false;
  }

  if (expectedLength > std::numeric_limits<uint32_t>::max()) {
    ThrowSpiceError(Napi::Error::New(
        env,
        std::string("Internal error: expectedLength is too large while reading ") + safeName));
    return false;
  }

  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(safeName) + " must be an array"));
    return false;
  }

  Napi::Array arr = value.As<Napi::Array>();
  const uint32_t expectedLength32 = static_cast<uint32_t>(expectedLength);
  if (arr.Length() != expectedLength32) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        std::string(safeName) + " must have length " + std::to_string(expectedLength)));
    return false;
  }

  for (size_t i = 0; i < expectedLength; i++) {
    const uint32_t idx = static_cast<uint32_t>(i);
    const Napi::Value v = arr.Get(idx);
    if (!v.IsNumber()) {
      ThrowSpiceError(
          Napi::TypeError::New(env, std::string(safeName) + " must contain only numbers"));
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

}  // namespace tspice_backend_node
