#include "test_exports.h"

#include <algorithm>

#include "napi_helpers.h"

using tspice_napi::FixedWidthToJsString;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static Napi::String TestFixedWidthToJsString(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsBuffer() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "__testFixedWidthToJsString(buf: Buffer, width: number) expects (Buffer, number)"));
    return Napi::String::New(env, "");
  }

  const Napi::Buffer<char> buf = info[0].As<Napi::Buffer<char>>();

  const int64_t requestedWidthI64 = info[1].As<Napi::Number>().Int64Value();
  if (requestedWidthI64 < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "width must be >= 0"));
    return Napi::String::New(env, "");
  }

  const size_t requestedWidth = static_cast<size_t>(requestedWidthI64);
  const size_t width = std::min(requestedWidth, buf.Length());

  return FixedWidthToJsString(env, buf.Data(), width);
}

namespace tspice_backend_node {

void RegisterTestExports(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(
          env,
          exports,
          "__testFixedWidthToJsString",
          Napi::Function::New(env, TestFixedWidthToJsString),
          __func__)) {
    return;
  }
}

}  // namespace tspice_backend_node
