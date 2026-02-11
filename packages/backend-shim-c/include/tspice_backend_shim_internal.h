#ifndef TSPICE_BACKEND_SHIM_INTERNAL_H
#define TSPICE_BACKEND_SHIM_INTERNAL_H

// Internal helpers shared across backend-shim-c translation units.
// Not part of the public API; may change without notice.

#include <stdio.h>
#include <stddef.h>

// Writes an error message to `err` (when provided).
//
// Contract: `errMaxBytes` is an int (for easier FFI bindings); values <= 0 mean
// "no error buffer".
static inline void tspice_write_error(char *err, int errMaxBytes, const char *message) {
  if (!err || errMaxBytes <= 0) return;

  // Ensure stable, NUL-terminated error strings.
  //
  // Note: snprintf() always NUL-terminates if size > 0, but we defensively set the
  // last byte as well so callers can rely on termination even if code changes.
  snprintf(err, (size_t)errMaxBytes, "%s", message ? message : "Unknown error");
  err[errMaxBytes - 1] = '\0';
}

// Convenience helper for call sites that want to both write an error and return
// a failure result.
static inline int tspice_fail(char *err, int errMaxBytes, const char *message) {
  tspice_write_error(err, errMaxBytes, message);
  return 1;
}

#endif
