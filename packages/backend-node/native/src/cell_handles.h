#pragma once

#include <cstdint>

#include <SpiceUsr.h>

#include <napi.h>

namespace tspice_backend_node {

// NOTE: all functions in this file assume `g_cspice_mutex` is held by the caller.

// Allocates a new unique handle for `ptr`.
//
// Returns 0 and throws a JS exception on internal failure (e.g. handle space exhaustion).
uint32_t AddCellHandle(Napi::Env env, uintptr_t ptr, const char *context);

bool TryGetCellPtr(uint32_t handle, uintptr_t *outPtr);

bool RemoveCellPtr(uint32_t handle, uintptr_t *outPtr);

bool ReadCellHandleArg(Napi::Env env, const Napi::Value &value, const char *label, uint32_t *outHandle);

uintptr_t GetCellHandlePtrOrThrow(
    Napi::Env env,
    uint32_t handle,
    const char *context,
    const char *kindLabel);

// Like GetCellHandlePtrOrThrow(env, handle, context, kindLabel), but also
// validates that the underlying SpiceCell has the expected dtype.
uintptr_t GetCellHandlePtrOrThrow(
    Napi::Env env,
    uint32_t handle,
    SpiceDataType expectedDtype,
    const char *context,
    const char *kindLabel);

}  // namespace tspice_backend_node
