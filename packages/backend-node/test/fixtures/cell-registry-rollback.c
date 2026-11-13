#include "tspice_backend_shim.h"
#include "SpiceUsr.h"
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

static int live_allocations = 0;
static size_t payload_request = 0;
void *rollback_test_malloc(size_t size) {
  if (size > 1024) { payload_request = size; return NULL; }
  void *ptr = malloc(size);
  if (ptr) live_allocations++;
  return ptr;
}
void rollback_test_free(void *ptr) {
  if (ptr) live_allocations--;
  free(ptr);
}
void *rollback_test_realloc(void *ptr, size_t size) {
  (void)ptr;
  (void)size;
  return NULL; /* Force the registry's first growth to fail deterministically. */
}
int main(void) {
  for (int kind = 0; kind < 4; kind++) {
    uintptr_t handle = 0;
    char err[1841] = {0};
    int result;
    if (kind == 0) result = tspice_new_int_cell(2, &handle, err, sizeof(err));
    else if (kind == 1) result = tspice_new_double_cell(2, &handle, err, sizeof(err));
    else if (kind == 2) result = tspice_new_char_cell(2, 8, &handle, err, sizeof(err));
    else result = tspice_new_window(2, &handle, err, sizeof(err));
    if (result == 0 || handle != 0 || live_allocations != 0) {
      fprintf(stderr, "kind=%d result=%d handle=%llu live_allocations=%d error=%s\n",
          kind, result, (unsigned long long)handle, live_allocations, err);
      return 1;
    }
  }
  for (int kind = 0; kind < 4; kind++) {
    char err[1841] = {0};
    int result;
    if (kind == 0) result = tspice_new_int_cell(2, NULL, err, sizeof(err));
    else if (kind == 1) result = tspice_new_double_cell(2, NULL, err, sizeof(err));
    else if (kind == 2) result = tspice_new_char_cell(2, 8, NULL, err, sizeof(err));
    else result = tspice_new_window(2, NULL, err, sizeof(err));
    if (result == 0 || live_allocations != 0) {
      fprintf(stderr, "null-output kind=%d result=%d live_allocations=%d\n", kind, result, live_allocations);
      return 1;
    }
  }
  /* Observe boundary arithmetic without allocating huge backing storage. */
  if (SIZE_MAX > UINT32_MAX) {
    for (int kind = 0; kind < 4; kind++) {
      uintptr_t handle = 0;
      char err[1841] = {0};
      payload_request = 0;
      int result;
      size_t expected;
      if (kind == 0) {
        expected = ((size_t)SPICE_CELL_CTRLSZ + INT_MAX) * sizeof(SpiceInt);
        result = tspice_new_int_cell(INT_MAX, &handle, err, sizeof(err));
      } else if (kind == 1) {
        expected = ((size_t)SPICE_CELL_CTRLSZ + INT_MAX) * sizeof(SpiceDouble);
        result = tspice_new_double_cell(INT_MAX, &handle, err, sizeof(err));
      } else if (kind == 2) {
        expected = ((size_t)SPICE_CELL_CTRLSZ + INT_MAX) * (size_t)INT_MAX;
        result = tspice_new_char_cell(INT_MAX, INT_MAX, &handle, err, sizeof(err));
      } else {
        expected = ((size_t)SPICE_CELL_CTRLSZ + 2 * (INT_MAX / 2)) * sizeof(SpiceDouble);
        result = tspice_new_window(INT_MAX / 2, &handle, err, sizeof(err));
      }
      if (result == 0 || handle != 0 || live_allocations != 0 || payload_request != expected) {
        fprintf(stderr, "allocation-arithmetic kind=%d requested=%llu expected=%llu live=%d\n",
            kind, (unsigned long long)payload_request, (unsigned long long)expected, live_allocations);
        return 1;
      }
    }
  }
  return 0;
}
