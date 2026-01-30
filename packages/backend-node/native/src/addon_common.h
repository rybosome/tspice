#pragma once

#include <napi.h>

#include <mutex>

// Shared globals/helpers used across multiple domain spokes.

namespace tspice_backend_node {

extern std::mutex g_cspice_mutex;

inline constexpr int kErrMaxBytes = 2048;
inline constexpr int kOutMaxBytes = 2048;

bool ReadNumberArrayFixed(
    Napi::Env env,
    const Napi::Value& value,
    size_t expectedLength,
    double* out,
    const char* name);

bool ReadVec3(Napi::Env env, const Napi::Value& value, double out[3], const char* name);

bool ReadMat33RowMajor(
    Napi::Env env,
    const Napi::Value& value,
    double out[9],
    const char* name);

}  // namespace tspice_backend_node
