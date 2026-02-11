#ifndef TSPICE_HANDLE_VALIDATION_H
#define TSPICE_HANDLE_VALIDATION_H

#include <stdint.h>

#include "SpiceUsr.h"

#ifdef __cplusplus
extern "C" {
#endif

// Shared (internal) handle validation helper.
//
// The C shim treats `uintptr_t` handles as opaque pointers, but validates them
// against the cells/windows registry to prevent use-after-free.
//
// Returns NULL and writes a stable error message on failure.
SpiceCell *tspice_validate_handle(
    uintptr_t handle,
    const char *kind,
    const char *ctx,
    char *err,
    int errMaxBytes);

#ifdef __cplusplus
}
#endif

#endif
