#include "tspice_backend_shim.h"

#include "SpiceUsr.h"
#include "SpiceZmc.h"

#include "../handle_validation.h"

#include <inttypes.h>
#include <limits.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int tspice_write_error(char *err, int errMaxBytes, const char *message) {
  if (err && errMaxBytes > 0) {
    strncpy(err, message, (size_t)errMaxBytes - 1);
    err[errMaxBytes - 1] = '\0';
  }
  return 1;
}

// ---- Checked casts --------------------------------------------------------

static int tspice_int_to_spice_int_checked(
    int value,
    SpiceInt *out,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  if (!out) return tspice_write_error(err, errMaxBytes, "tspice_int_to_spice_int_checked(): out must be non-null");
  const SpiceInt v = (SpiceInt)value;
  if ((int)v != value) {
    char buf[200];
    snprintf(buf, sizeof(buf), "%s: int value out of SpiceInt range (%d)", ctx, value);
    return tspice_write_error(err, errMaxBytes, buf);
  }
  *out = v;
  return 0;
}

static int tspice_spice_int_to_int_checked(
    SpiceInt value,
    int *out,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  if (!out) return tspice_write_error(err, errMaxBytes, "tspice_spice_int_to_int_checked(): out must be non-null");
  const int v = (int)value;
  if ((SpiceInt)v != value) {
    char buf[220];
    snprintf(buf, sizeof(buf), "%s: SpiceInt value out of int range (%" PRIdMAX ")", ctx, (intmax_t)value);
    return tspice_write_error(err, errMaxBytes, buf);
  }
  *out = v;
  return 0;
}

// ---------------------------------------------------------------------------

static SpiceCell *tspice_as_cell(uintptr_t handle) { return (SpiceCell *)handle; }

static int tspice_alloc_and_init_int_cell(SpiceInt size, uintptr_t *outCell, char *err, int errMaxBytes) {
  if (size < 0) {
    return tspice_write_error(err, errMaxBytes, "tspice_new_int_cell(): size must be >= 0");
  }

  SpiceCell *cell = (SpiceCell *)malloc(sizeof(SpiceCell));
  if (!cell) {
    return tspice_write_error(err, errMaxBytes, "tspice_new_int_cell(): malloc(cell) failed");
  }

  SpiceInt *base = (SpiceInt *)malloc((size_t)(SPICE_CELL_CTRLSZ + size) * sizeof(SpiceInt));
  if (!base) {
    free(cell);
    return tspice_write_error(err, errMaxBytes, "tspice_new_int_cell(): malloc(base) failed");
  }

  memset(cell, 0, sizeof(*cell));
  memset(base, 0, (size_t)(SPICE_CELL_CTRLSZ + size) * sizeof(SpiceInt));

  cell->dtype = SPICE_INT;
  cell->length = 0;
  cell->size = 0;
  cell->card = 0;
  cell->isSet = SPICETRUE;
  cell->adjust = SPICEFALSE;
  cell->init = SPICEFALSE;
  cell->base = (void *)base;
  cell->data = (void *)(base + SPICE_CELL_CTRLSZ);

  // Initialize the cell's control area the same way CSPICE expects for
  // stack-allocated cells created via `SPICE*_CELL` macros.
  ssize_c(size, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    free(base);
    free(cell);
    return 1;
  }
  scard_c(0, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    free(base);
    free(cell);
    return 1;
  }

  if (outCell) {
    *outCell = (uintptr_t)cell;
  }
  return 0;
}

static int tspice_alloc_and_init_double_cell(
    SpiceInt size,
    uintptr_t *outCell,
    char *err,
    int errMaxBytes) {
  if (size < 0) {
    return tspice_write_error(err, errMaxBytes, "tspice_new_double_cell(): size must be >= 0");
  }

  SpiceCell *cell = (SpiceCell *)malloc(sizeof(SpiceCell));
  if (!cell) {
    return tspice_write_error(err, errMaxBytes, "tspice_new_double_cell(): malloc(cell) failed");
  }

  SpiceDouble *base =
      (SpiceDouble *)malloc((size_t)(SPICE_CELL_CTRLSZ + size) * sizeof(SpiceDouble));
  if (!base) {
    free(cell);
    return tspice_write_error(err, errMaxBytes, "tspice_new_double_cell(): malloc(base) failed");
  }

  memset(cell, 0, sizeof(*cell));
  memset(base, 0, (size_t)(SPICE_CELL_CTRLSZ + size) * sizeof(SpiceDouble));

  cell->dtype = SPICE_DP;
  cell->length = 0;
  cell->size = 0;
  cell->card = 0;
  cell->isSet = SPICETRUE;
  cell->adjust = SPICEFALSE;
  cell->init = SPICEFALSE;
  cell->base = (void *)base;
  cell->data = (void *)(base + SPICE_CELL_CTRLSZ);

  ssize_c(size, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    free(base);
    free(cell);
    return 1;
  }
  scard_c(0, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    free(base);
    free(cell);
    return 1;
  }

  if (outCell) {
    *outCell = (uintptr_t)cell;
  }
  return 0;
}

// Like `SPICEDOUBLE_CELL` initializer: set up descriptor + pointers, but do not
// call `ssize_c/scard_c`.
//
// Window routines typically expect initialization via `wnvald_c(size, n, window)`.
static int tspice_alloc_and_init_double_cell_uninitialized(
    SpiceInt capacity,
    uintptr_t *outCell,
    char *err,
    int errMaxBytes) {
  if (capacity < 0) {
    return tspice_write_error(err, errMaxBytes, "tspice_new_window(): size must be >= 0");
  }

  SpiceCell *cell = (SpiceCell *)malloc(sizeof(SpiceCell));
  if (!cell) {
    return tspice_write_error(err, errMaxBytes, "tspice_new_window(): malloc(cell) failed");
  }

  SpiceDouble *base =
      (SpiceDouble *)malloc((size_t)(SPICE_CELL_CTRLSZ + capacity) * sizeof(SpiceDouble));
  if (!base) {
    free(cell);
    return tspice_write_error(err, errMaxBytes, "tspice_new_window(): malloc(base) failed");
  }

  memset(cell, 0, sizeof(*cell));
  memset(base, 0, (size_t)(SPICE_CELL_CTRLSZ + capacity) * sizeof(SpiceDouble));

  cell->dtype = SPICE_DP;
  cell->length = 0;
  cell->size = capacity;
  cell->card = 0;
  cell->isSet = SPICETRUE;
  cell->adjust = SPICEFALSE;
  cell->init = SPICEFALSE;
  cell->base = (void *)base;
  cell->data = (void *)(base + SPICE_CELL_CTRLSZ);

  if (outCell) {
    *outCell = (uintptr_t)cell;
  }
  return 0;
}

static int tspice_alloc_and_init_char_cell(
    SpiceInt size,
    SpiceInt length,
    uintptr_t *outCell,
    char *err,
    int errMaxBytes) {
  if (size < 0) {
    return tspice_write_error(err, errMaxBytes, "tspice_new_char_cell(): size must be >= 0");
  }
  if (length <= 0) {
    return tspice_write_error(err, errMaxBytes, "tspice_new_char_cell(): length must be > 0");
  }

  SpiceCell *cell = (SpiceCell *)malloc(sizeof(SpiceCell));
  if (!cell) {
    return tspice_write_error(err, errMaxBytes, "tspice_new_char_cell(): malloc(cell) failed");
  }

  // Each "element" is a fixed-length string of `length` chars.
  const size_t totalElements = (size_t)(SPICE_CELL_CTRLSZ + size);
  const size_t bytes = totalElements * (size_t)length * sizeof(SpiceChar);

  SpiceChar *base = (SpiceChar *)malloc(bytes);
  if (!base) {
    free(cell);
    return tspice_write_error(err, errMaxBytes, "tspice_new_char_cell(): malloc(base) failed");
  }

  memset(cell, 0, sizeof(*cell));
  memset(base, 0, bytes);

  cell->dtype = SPICE_CHR;
  cell->length = length;
  cell->size = 0;
  cell->card = 0;
  cell->isSet = SPICETRUE;
  cell->adjust = SPICEFALSE;
  cell->init = SPICEFALSE;
  cell->base = (void *)base;
  cell->data = (void *)(base + (size_t)SPICE_CELL_CTRLSZ * (size_t)length);

  ssize_c(size, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    free(base);
    free(cell);
    return 1;
  }
  scard_c(0, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    free(base);
    free(cell);
    return 1;
  }

  if (outCell) {
    *outCell = (uintptr_t)cell;
  }
  return 0;
}

int tspice_new_int_cell(int size, uintptr_t *outCell, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt sz = 0;
  if (tspice_int_to_spice_int_checked(size, &sz, "tspice_new_int_cell()", err, errMaxBytes) != 0) {
    return 1;
  }

  const int code = tspice_alloc_and_init_int_cell(sz, outCell, err, errMaxBytes);
  if (code != 0) return code;

  if (outCell && *outCell) {
    SpiceCell *cell = (SpiceCell *)(*outCell);
    const int reg = tspice_registry_add(cell, "tspice_new_int_cell()", err, errMaxBytes);
    if (reg != 0) {
      tspice_free_cell(*outCell, NULL, 0);
      *outCell = 0;
      return 1;
    }
  }
  return 0;
}

int tspice_new_double_cell(int size, uintptr_t *outCell, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt sz = 0;
  if (tspice_int_to_spice_int_checked(size, &sz, "tspice_new_double_cell()", err, errMaxBytes) != 0) {
    return 1;
  }

  const int code = tspice_alloc_and_init_double_cell(sz, outCell, err, errMaxBytes);
  if (code != 0) return code;

  if (outCell && *outCell) {
    SpiceCell *cell = (SpiceCell *)(*outCell);
    const int reg = tspice_registry_add(cell, "tspice_new_double_cell()", err, errMaxBytes);
    if (reg != 0) {
      tspice_free_cell(*outCell, NULL, 0);
      *outCell = 0;
      return 1;
    }
  }
  return 0;
}

int tspice_new_char_cell(
    int size,
    int length,
    uintptr_t *outCell,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt sz = 0;
  SpiceInt len = 0;
  if (tspice_int_to_spice_int_checked(size, &sz, "tspice_new_char_cell()", err, errMaxBytes) != 0) {
    return 1;
  }
  if (tspice_int_to_spice_int_checked(length, &len, "tspice_new_char_cell()", err, errMaxBytes) != 0) {
    return 1;
  }

  const int code = tspice_alloc_and_init_char_cell(sz, len, outCell, err, errMaxBytes);
  if (code != 0) return code;

  if (outCell && *outCell) {
    SpiceCell *cell = (SpiceCell *)(*outCell);
    const int reg = tspice_registry_add(cell, "tspice_new_char_cell()", err, errMaxBytes);
    if (reg != 0) {
      tspice_free_cell(*outCell, NULL, 0);
      *outCell = 0;
      return 1;
    }
  }

  return 0;
}

int tspice_new_window(int maxIntervals, uintptr_t *outWindow, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (maxIntervals < 0) {
    return tspice_write_error(err, errMaxBytes, "tspice_new_window(): maxIntervals must be >= 0");
  }
  if (maxIntervals > (INT_MAX / 2)) {
    return tspice_write_error(err, errMaxBytes, "tspice_new_window(): maxIntervals too large");
  }

  SpiceInt endpoints = 0;
  if (tspice_int_to_spice_int_checked(2 * maxIntervals, &endpoints, "tspice_new_window()", err, errMaxBytes) != 0) {
    return 1;
  }

  const int code =
      tspice_alloc_and_init_double_cell_uninitialized(endpoints, outWindow, err, errMaxBytes);
  if (code != 0) {
    return code;
  }

  SpiceCell *window = (SpiceCell *)(*outWindow);
  const int reg = tspice_registry_add(window, "tspice_new_window()", err, errMaxBytes);
  if (reg != 0) {
    tspice_free_cell(*outWindow, NULL, 0);
    *outWindow = 0;
    return 1;
  }

  // Initialize the cell control area in the backing `base` array; window
  // routines (e.g. `wninsd`) call `sized_`/`cardd_` on the base array.
  ssize_c(endpoints, window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    tspice_free_cell(*outWindow, NULL, 0);
    *outWindow = 0;
    return 1;
  }
  scard_c(0, window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    tspice_free_cell(*outWindow, NULL, 0);
    *outWindow = 0;
    return 1;
  }

  return 0;
}

int tspice_free_cell(uintptr_t cellHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_free_cell()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  (void)tspice_registry_remove(cell);

  if (cell->base) {
    free(cell->base);
  }
  free(cell);
  return 0;
}

int tspice_free_window(uintptr_t windowHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *window = tspice_validate_handle(windowHandle, "window", "tspice_free_window()", err, errMaxBytes);
  if (!window) {
    return 1;
  }

  (void)tspice_registry_remove(window);

  if (window->base) {
    free(window->base);
  }
  free(window);
  return 0;
}

int tspice_char_cell_length(uintptr_t cellHandle, int *outLength, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outLength) {
    *outLength = 0;
  }

  SpiceCell *cell = tspice_validate_handle(
      cellHandle, "cell", "tspice_char_cell_length()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  if (cell->dtype != SPICE_CHR) {
    return tspice_write_error(err, errMaxBytes, "tspice_char_cell_length(): expected SPICE_CHR cell");
  }

  const SpiceInt length = cell->length;
  if (length <= 0) {
    return tspice_write_error(err, errMaxBytes, "tspice_char_cell_length(): invalid cell length");
  }

  if (outLength) {
    return tspice_spice_int_to_int_checked(length, outLength, "tspice_char_cell_length()", err, errMaxBytes);
  }

  return 0;
}

int tspice_ssize(int size, uintptr_t cellHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_ssize()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  SpiceInt sz = 0;
  if (tspice_int_to_spice_int_checked(size, &sz, "tspice_ssize()", err, errMaxBytes) != 0) {
    return 1;
  }

  ssize_c(sz, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_scard(int card, uintptr_t cellHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_scard()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  SpiceInt c = 0;
  if (tspice_int_to_spice_int_checked(card, &c, "tspice_scard()", err, errMaxBytes) != 0) {
    return 1;
  }

  scard_c(c, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_card(uintptr_t cellHandle, int *outCard, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCard) {
    *outCard = 0;
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_card()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  SpiceInt card = card_c(cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outCard) {
    return tspice_spice_int_to_int_checked(card, outCard, "tspice_card()", err, errMaxBytes);
  }

  return 0;
}

int tspice_size(uintptr_t cellHandle, int *outSize, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outSize) {
    *outSize = 0;
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_size()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  SpiceInt size = size_c(cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outSize) {
    return tspice_spice_int_to_int_checked(size, outSize, "tspice_size()", err, errMaxBytes);
  }

  return 0;
}

int tspice_valid(int size, int n, uintptr_t cellHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_valid()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  SpiceInt sz = 0;
  SpiceInt nn = 0;
  if (tspice_int_to_spice_int_checked(size, &sz, "tspice_valid()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(n, &nn, "tspice_valid()", err, errMaxBytes) != 0) return 1;

  valid_c(sz, nn, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_insrti(int item, uintptr_t cellHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_insrti()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  if (cell->dtype != SPICE_INT) {
    return tspice_write_error(err, errMaxBytes, "tspice_insrti(): expected SPICE_INT cell");
  }

  SpiceInt it = 0;
  if (tspice_int_to_spice_int_checked(item, &it, "tspice_insrti()", err, errMaxBytes) != 0) {
    return 1;
  }

  insrti_c(it, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_insrtd(double item, uintptr_t cellHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_insrtd()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  if (cell->dtype != SPICE_DP) {
    return tspice_write_error(err, errMaxBytes, "tspice_insrtd(): expected SPICE_DP cell");
  }

  insrtd_c((SpiceDouble)item, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_insrtc(const char *item, uintptr_t cellHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (!item) {
    return tspice_write_error(err, errMaxBytes, "tspice_insrtc(): item must be non-null");
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_insrtc()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  if (cell->dtype != SPICE_CHR) {
    return tspice_write_error(err, errMaxBytes, "tspice_insrtc(): expected SPICE_CHR cell");
  }

  insrtc_c(item, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_cell_geti(uintptr_t cellHandle, int index, int *outItem, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outItem) {
    *outItem = 0;
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_cell_geti()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  if (cell->dtype != SPICE_INT) {
    return tspice_write_error(err, errMaxBytes, "tspice_cell_geti(): expected SPICE_INT cell");
  }

  SpiceInt idx = 0;
  if (tspice_int_to_spice_int_checked(index, &idx, "tspice_cell_geti()", err, errMaxBytes) != 0) {
    return 1;
  }

  const SpiceInt card = card_c(cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (idx < 0 || idx >= card) {
    return tspice_write_error(err, errMaxBytes, "tspice_cell_geti(): index out of range");
  }

  SpiceInt item = 0;
  SPICE_CELL_GET_I(cell, idx, &item);

  if (outItem) {
    return tspice_spice_int_to_int_checked(item, outItem, "tspice_cell_geti()", err, errMaxBytes);
  }

  return 0;
}



int tspice_cell_getd(uintptr_t cellHandle, int index, double *outItem, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outItem) {
    *outItem = 0.0;
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_cell_getd()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  if (cell->dtype != SPICE_DP) {
    return tspice_write_error(err, errMaxBytes, "tspice_cell_getd(): expected SPICE_DP cell");
  }

  SpiceInt idx = 0;
  if (tspice_int_to_spice_int_checked(index, &idx, "tspice_cell_getd()", err, errMaxBytes) != 0) {
    return 1;
  }

  const SpiceInt card = card_c(cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (idx < 0 || idx >= card) {
    return tspice_write_error(err, errMaxBytes, "tspice_cell_getd(): index out of range");
  }

  SpiceDouble item = 0.0;
  SPICE_CELL_GET_D(cell, idx, &item);
  if (outItem) {
    *outItem = (double)item;
  }
  return 0;
}



int tspice_cell_getc(
    uintptr_t cellHandle,
    int index,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (!out || outMaxBytes <= 0) {
    return tspice_write_error(err, errMaxBytes, "tspice_cell_getc(): outMaxBytes must be > 0");
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_cell_getc()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  if (cell->dtype != SPICE_CHR) {
    return tspice_write_error(err, errMaxBytes, "tspice_cell_getc(): expected SPICE_CHR cell");
  }

  SpiceInt idx = 0;
  if (tspice_int_to_spice_int_checked(index, &idx, "tspice_cell_getc()", err, errMaxBytes) != 0) {
    return 1;
  }

  SpiceInt outMax = 0;
  if (tspice_int_to_spice_int_checked(outMaxBytes, &outMax, "tspice_cell_getc()", err, errMaxBytes) != 0) {
    return 1;
  }

  const SpiceInt card = card_c(cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (idx < 0 || idx >= card) {
    return tspice_write_error(err, errMaxBytes, "tspice_cell_getc(): index out of range");
  }

  SPICE_CELL_GET_C(cell, idx, outMax, out);
  return 0;
}



int tspice_wninsd(double left, double right, uintptr_t windowHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *window = tspice_validate_handle(windowHandle, "window", "tspice_wninsd()", err, errMaxBytes);
  if (!window) {
    return 1;
  }

  if (window->dtype != SPICE_DP) {
    return tspice_write_error(err, errMaxBytes, "tspice_wninsd(): expected SPICE_DP window");
  }

  window->init = SPICEFALSE;

  wninsd_c((SpiceDouble)left, (SpiceDouble)right, window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}



int tspice_wncard(uintptr_t windowHandle, int *outCard, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCard) {
    *outCard = 0;
  }

  SpiceCell *window = tspice_validate_handle(windowHandle, "window", "tspice_wncard()", err, errMaxBytes);
  if (!window) {
    return 1;
  }

  if (window->dtype != SPICE_DP) {
    return tspice_write_error(err, errMaxBytes, "tspice_wncard(): expected SPICE_DP window");
  }

  window->init = SPICEFALSE;

  SpiceInt card = wncard_c(window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outCard) {
    return tspice_spice_int_to_int_checked(card, outCard, "tspice_wncard()", err, errMaxBytes);
  }

  return 0;
}



int tspice_wnfetd(
    uintptr_t windowHandle,
    int index,
    double *outLeft,
    double *outRight,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outLeft) {
    *outLeft = 0.0;
  }
  if (outRight) {
    *outRight = 0.0;
  }

  SpiceCell *window = tspice_validate_handle(windowHandle, "window", "tspice_wnfetd()", err, errMaxBytes);
  if (!window) {
    return 1;
  }

  if (window->dtype != SPICE_DP) {
    return tspice_write_error(err, errMaxBytes, "tspice_wnfetd(): expected SPICE_DP window");
  }

  SpiceInt idx = 0;
  if (tspice_int_to_spice_int_checked(index, &idx, "tspice_wnfetd()", err, errMaxBytes) != 0) {
    return 1;
  }

  window->init = SPICEFALSE;

  SpiceDouble left = 0.0;
  SpiceDouble right = 0.0;
  wnfetd_c(window, idx, &left, &right);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outLeft) {
    *outLeft = (double)left;
  }
  if (outRight) {
    *outRight = (double)right;
  }
  return 0;
}



int tspice_wnvald(int size, int n, uintptr_t windowHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *window = tspice_validate_handle(windowHandle, "window", "tspice_wnvald()", err, errMaxBytes);
  if (!window) {
    return 1;
  }

  if (window->dtype != SPICE_DP) {
    return tspice_write_error(err, errMaxBytes, "tspice_wnvald(): expected SPICE_DP window");
  }

  SpiceInt sz = 0;
  SpiceInt nn = 0;
  if (tspice_int_to_spice_int_checked(size, &sz, "tspice_wnvald()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(n, &nn, "tspice_wnvald()", err, errMaxBytes) != 0) return 1;

  window->init = SPICEFALSE;

  wnvald_c(sz, nn, window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}
