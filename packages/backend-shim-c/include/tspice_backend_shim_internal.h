#ifndef TSPICE_BACKEND_SHIM_INTERNAL_H
#define TSPICE_BACKEND_SHIM_INTERNAL_H

// Internal helpers shared across backend-shim-c translation units.
// Not part of the public API; may change without notice.

#include <stddef.h>
#include <stdio.h>

static inline int tspice_write_error(char *err, int errMaxBytes, const char *message) {
  if (!err || errMaxBytes <= 0) return 1;

  // Ensure stable, NUL-terminated error strings.
  //
  // Note: snprintf() always NUL-terminates if size > 0, but we defensively set the
  // last byte as well so callers can rely on termination even if code changes.
  snprintf(err, (size_t)errMaxBytes, "%s", message ? message : "");
  err[errMaxBytes - 1] = '\0';

  return 1;
}

#endif
