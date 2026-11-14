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
int tspice_registry_add(SpiceCell *cell, int isWindow, const char *ctx, char *err, int errMaxBytes);
int tspice_registry_remove(SpiceCell *cell);

// Accept only a live allocation issued specifically as a window.
SpiceCell *tspice_validate_window_kind(uintptr_t handle, char *err, int errMaxBytes);

// Failed B03 result calls can leave the written Fortran cardinality different
// from SpiceCell.card. Other live handles use the ordinary descriptor path.
int tspice_preserves_window_control(const SpiceCell *window);
void tspice_set_window_control_preserved(const SpiceCell *window, int preserve);

// Validate a live normalized, bounded input window for an in-place query.
SpiceCell *tspice_validate_input_window(uintptr_t handle, char *err, int errMaxBytes);

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
