#pragma once

#include <stdint.h>

// The existing backend allocation limit is 256 MiB per physical double buffer.
// Keep this bound for both backends, including CSPICE's private product buffer.
#define TSPICE_MATRIX_MAX_ELEMENTS 33554432

static inline int tspice_matrix_count(int rows, int cols, int *count) {
  if (rows < 0 || cols < 0 ||
      (int64_t)rows * (int64_t)cols > TSPICE_MATRIX_MAX_ELEMENTS) return 0;
  *count = rows * cols;
  return 1;
}
