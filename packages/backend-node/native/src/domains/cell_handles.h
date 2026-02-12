#pragma once

#include <napi.h>

#include <cstdint>

namespace tspice_backend_node {

// IMPORTANT:
// The cell handle table is protected by `tspice_backend_node::g_cspice_mutex`.
// Callers MUST hold that mutex while calling into these helpers.

uintptr_t GetCellHandlePtrOrThrow(
    Napi::Env env,
    uint32_t handle,
    const char* context,
    const char* kindLabel);

}  // namespace tspice_backend_node
