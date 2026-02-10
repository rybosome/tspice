#pragma once

#include <stddef.h>
#include <stdio.h>

// Shared TU-local-ish error helper for the C shim.
//
// This is header-only (static inline) to avoid exporting symbols while keeping
// behavior consistent across translation units.
static inline int tspice_write_error(char *err, int errMaxBytes, const char *msg) {
  if (!err || errMaxBytes <= 0) return 1;

  // Ensure stable, NUL-terminated error strings.
  snprintf(err, (size_t)errMaxBytes, "%s", msg ? msg : "");
  err[errMaxBytes - 1] = '\0';
  return 1;
}
