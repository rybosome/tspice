#pragma once

#include <cstdint>

#include <napi.h>

namespace tspice_backend_node {

// NOTE: all functions in this file assume `g_cspice_mutex` is held by the caller.

uint32_t AddCellHandle(uintptr_t ptr);

bool TryGetCellPtr(uint32_t handle, uintptr_t *outPtr);

bool RemoveCellPtr(uint32_t handle, uintptr_t *outPtr);

bool ReadCellHandleArg(Napi::Env env, const Napi::Value &value, const char *label, uint32_t *outHandle);

uintptr_t GetCellHandlePtrOrThrow(
    Napi::Env env,
    uint32_t handle,
    const char *context,
    const char *kindLabel);

}  // namespace tspice_backend_node
