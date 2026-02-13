#pragma once

#include <napi.h>

#include <mutex>

// Shared globals/helpers used across multiple domain spokes.

namespace tspice_backend_node {

extern std::mutex g_cspice_mutex;

// RAII helper for ensuring all CSPICE and handle-registry operations remain
// serialized under the single global mutex.
//
// Note: this is intentionally a non-copyable, non-movable "token" type. Code
// that mutates/reads shared registries should require a `const CspiceLock&`
// parameter so the locking requirement is enforced at compile time.
class CspiceLock {
public:
  CspiceLock() : lock_(g_cspice_mutex) {}

  CspiceLock(const CspiceLock&) = delete;
  CspiceLock& operator=(const CspiceLock&) = delete;

private:
  std::lock_guard<std::mutex> lock_;
};

inline constexpr int kErrMaxBytes = 2048;
inline constexpr int kOutMaxBytes = 2048;
// CSPICE EK string outputs (e.g. `ekgc_c`) are truncated at ~1024 characters.
// Keep this buffer >= 1025 bytes (1024 chars + NUL) so we don't truncate earlier.
static_assert(kOutMaxBytes >= 1025, "kOutMaxBytes must be >= 1025 bytes (1024 chars + NUL)");

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
