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

// Internal registry helpers used by the cells/windows domain to register and
// retire handles.
int tspice_registry_add(SpiceCell *cell, const char *ctx, char *err, int errMaxBytes);
int tspice_registry_remove(SpiceCell *cell);

// Enforce the caller precondition that a size cannot exceed original allocated
// backing storage. CSPICE cannot detect this from the mutable cell descriptor.
int tspice_validate_cell_capacity(
    SpiceCell *cell,
    SpiceInt size,
    const char *ctx,
    char *err,
    int errMaxBytes);

#ifdef __cplusplus
}
#endif

#endif
