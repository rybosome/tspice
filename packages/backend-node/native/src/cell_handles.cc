#include "cell_handles.h"

#include <cmath>
#include <cstdint>
#include <limits>
#include <unordered_map>

#include "napi_helpers.h"

using tspice_napi::ThrowSpiceError;

namespace tspice_backend_node {

static uint32_t g_next_cell_handle = 1;
static std::unordered_map<uint32_t, uintptr_t> g_cell_handles;

uint32_t AddCellHandle(uintptr_t ptr) {
  uint32_t handle = g_next_cell_handle++;
  if (handle == 0) {
    handle = g_next_cell_handle++;
  }
  g_cell_handles[handle] = ptr;
  return handle;
}

bool TryGetCellPtr(uint32_t handle, uintptr_t *outPtr) {
  auto it = g_cell_handles.find(handle);
  if (it == g_cell_handles.end()) {
    return false;
  }
  if (outPtr != nullptr) {
    *outPtr = it->second;
  }
  return true;
}

bool RemoveCellPtr(uint32_t handle, uintptr_t *outPtr) {
  auto it = g_cell_handles.find(handle);
  if (it == g_cell_handles.end()) {
    return false;
  }
  if (outPtr != nullptr) {
    *outPtr = it->second;
  }
  g_cell_handles.erase(it);
  return true;
}

bool ReadCellHandleArg(Napi::Env env, const Napi::Value &value, const char *label, uint32_t *outHandle) {
  const std::string handleLabel =
      (label != nullptr && label[0] != '\0') ? std::string(label) : std::string("handle");

  if (!value.IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + handleLabel + " to be a number"));
    return false;
  }

  const double d = value.As<Napi::Number>().DoubleValue();
  const double lo = 0;
  const double hi = (double)std::numeric_limits<uint32_t>::max();
  if (!std::isfinite(d) || std::floor(d) != d || d < lo || d > hi) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + handleLabel + " to be a uint32"));
    return false;
  }

  *outHandle = (uint32_t)d;
  return true;
}

uintptr_t GetCellHandlePtrOrThrow(
    Napi::Env env,
    uint32_t handle,
    const char *context,
    const char *kindLabel) {
  uintptr_t ptr = 0;
  if (!TryGetCellPtr(handle, &ptr)) {
    const std::string ctx = (context != nullptr && context[0] != '\0') ? std::string(context) : std::string("call");
    const std::string kind = (kindLabel != nullptr && kindLabel[0] != '\0') ? std::string(kindLabel)
                                                                              : std::string("SpiceCell");
    ThrowSpiceError(Napi::TypeError::New(env, ctx + ": unknown/expired " + kind + " handle: " + std::to_string(handle)));
    return 0;
  }
  return ptr;
}

}  // namespace tspice_backend_node
