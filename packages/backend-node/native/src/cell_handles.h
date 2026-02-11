#pragma once

#include <cstdint>

#include <SpiceUsr.h>

#include <napi.h>

#include "addon_common.h"

namespace tspice_backend_node {

// NOTE: all functions in this file require `g_cspice_mutex` to be held by the caller.
// This is enforced by requiring a `const CspiceLock&` token for all registry
// access.

// Allocates a new unique handle for `ptr`.
//
// Returns 0 and throws a JS exception on internal failure (e.g. handle space exhaustion).
uint32_t AddCellHandle(const CspiceLock& lock, Napi::Env env, uintptr_t ptr, const char *context);

bool TryGetCellPtr(const CspiceLock& lock, uint32_t handle, uintptr_t *outPtr);

bool RemoveCellPtr(const CspiceLock& lock, uint32_t handle, uintptr_t *outPtr);

bool ReadCellHandleArg(Napi::Env env, const Napi::Value &value, const char *label, uint32_t *outHandle);

uintptr_t GetCellHandlePtrOrThrow(
    const CspiceLock& lock,
    Napi::Env env,
    uint32_t handle,
    const char *context,
    const char *kindLabel);

// Like GetCellHandlePtrOrThrow(lock, env, handle, context, kindLabel), but also
// validates that the underlying SpiceCell has the expected dtype.
uintptr_t GetCellHandlePtrOrThrow(
    const CspiceLock& lock,
    Napi::Env env,
    uint32_t handle,
    SpiceDataType expectedDtype,
    const char *context,
    const char *kindLabel);

}  // namespace tspice_backend_node
