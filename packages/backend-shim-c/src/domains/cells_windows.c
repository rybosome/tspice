#include "tspice_backend_shim.h"
#include "tspice_error.h"

#include "SpiceUsr.h"
#include "SpiceZmc.h"

#include "../handle_validation.h"

#include <inttypes.h>
#include <math.h>
#include <limits.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ---- Checked casts --------------------------------------------------------

static int tspice_int_to_spice_int_checked(
    int value,
    SpiceInt *out,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  if (!out) return tspice_return_error(err, errMaxBytes, "tspice_int_to_spice_int_checked(): out must be non-null");
  const SpiceInt v = (SpiceInt)value;
  if ((int)v != value) {
    char buf[200];
    snprintf(buf, sizeof(buf), "%s: int value out of SpiceInt range (%d)", ctx, value);
    return tspice_return_error(err, errMaxBytes, buf);
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
  if (!out) return tspice_return_error(err, errMaxBytes, "tspice_spice_int_to_int_checked(): out must be non-null");
  const int v = (int)value;
  if ((SpiceInt)v != value) {
    char buf[220];
    snprintf(buf, sizeof(buf), "%s: SpiceInt value out of int range (%" PRIdMAX ")", ctx, (intmax_t)value);
    return tspice_return_error(err, errMaxBytes, buf);
  }
  *out = v;
  return 0;
}

// ---------------------------------------------------------------------------

static SpiceCell *tspice_as_cell(uintptr_t handle) { return (SpiceCell *)handle; }

// Creation can fail before registration. Such storage cannot be released through
// the public free path, which deliberately rejects unregistered pointers.
static void tspice_destroy_cell_storage(SpiceCell *cell) {
  free(cell->base);
  free(cell);
}


// Compute in size_t before adding control slots, then check multiplication on
// both 32-bit WASM and native hosts. Signed SpiceInt addition can overflow first.
static int tspice_cell_storage_bytes(
    SpiceInt capacity, size_t elementBytes, size_t *outBytes, char *err, int errMaxBytes) {
  const size_t elements = (size_t)SPICE_CELL_CTRLSZ + (size_t)capacity;
  if (elementBytes == 0 || elements > SIZE_MAX / elementBytes) {
    return tspice_return_error(err, errMaxBytes, "Cell backing allocation exceeds addressable memory");
  }
  *outBytes = elements * elementBytes;
  return 0;
}

static int tspice_alloc_and_init_int_cell(SpiceInt size, uintptr_t *outCell, char *err, int errMaxBytes) {
  if (size < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_new_int_cell(): size must be >= 0");
  }

  size_t bytes = 0;
  if (tspice_cell_storage_bytes(size, sizeof(SpiceInt), &bytes, err, errMaxBytes) != 0) return 1;

  SpiceCell *cell = (SpiceCell *)malloc(sizeof(SpiceCell));
  if (!cell) {
    return tspice_return_error(err, errMaxBytes, "tspice_new_int_cell(): malloc(cell) failed");
  }

  SpiceInt *base = (SpiceInt *)malloc(bytes);
  if (!base) {
    free(cell);
    return tspice_return_error(err, errMaxBytes, "tspice_new_int_cell(): malloc(base) failed");
  }

  memset(cell, 0, sizeof(*cell));
  memset(base, 0, bytes);

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
    return tspice_return_error(err, errMaxBytes, "tspice_new_double_cell(): size must be >= 0");
  }

  size_t bytes = 0;
  if (tspice_cell_storage_bytes(size, sizeof(SpiceDouble), &bytes, err, errMaxBytes) != 0) return 1;

  SpiceCell *cell = (SpiceCell *)malloc(sizeof(SpiceCell));
  if (!cell) {
    return tspice_return_error(err, errMaxBytes, "tspice_new_double_cell(): malloc(cell) failed");
  }

  SpiceDouble *base =
      (SpiceDouble *)malloc(bytes);
  if (!base) {
    free(cell);
    return tspice_return_error(err, errMaxBytes, "tspice_new_double_cell(): malloc(base) failed");
  }

  memset(cell, 0, sizeof(*cell));
  memset(base, 0, bytes);

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
    return tspice_return_error(err, errMaxBytes, "tspice_new_window(): size must be >= 0");
  }

  size_t bytes = 0;
  // N0067 wnunid_ reads the first data value even in a logically empty
  // window. Keep one initialized data slot when the declared capacity is zero.
  if (tspice_cell_storage_bytes(capacity == 0 ? 1 : capacity, sizeof(SpiceDouble), &bytes, err, errMaxBytes) != 0) return 1;

  SpiceCell *cell = (SpiceCell *)malloc(sizeof(SpiceCell));
  if (!cell) {
    return tspice_return_error(err, errMaxBytes, "tspice_new_window(): malloc(cell) failed");
  }

  SpiceDouble *base =
      (SpiceDouble *)malloc(bytes);
  if (!base) {
    free(cell);
    return tspice_return_error(err, errMaxBytes, "tspice_new_window(): malloc(base) failed");
  }

  memset(cell, 0, sizeof(*cell));
  memset(base, 0, bytes);

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
    return tspice_return_error(err, errMaxBytes, "tspice_new_char_cell(): size must be >= 0");
  }
  if (length <= 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_new_char_cell(): length must be > 0");
  }

  size_t bytes = 0;
  if (tspice_cell_storage_bytes(size, (size_t)length, &bytes, err, errMaxBytes) != 0) return 1;

  SpiceCell *cell = (SpiceCell *)malloc(sizeof(SpiceCell));
  if (!cell) {
    return tspice_return_error(err, errMaxBytes, "tspice_new_char_cell(): malloc(cell) failed");
  }

  SpiceChar *base = (SpiceChar *)malloc(bytes);
  if (!base) {
    free(cell);
    return tspice_return_error(err, errMaxBytes, "tspice_new_char_cell(): malloc(base) failed");
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
  if (!outCell) return tspice_return_error(err, errMaxBytes, "tspice_new_int_cell(): outCell must be non-null");
  *outCell = 0;


  SpiceInt sz = 0;
  if (tspice_int_to_spice_int_checked(size, &sz, "tspice_new_int_cell()", err, errMaxBytes) != 0) {
    return 1;
  }

  const int code = tspice_alloc_and_init_int_cell(sz, outCell, err, errMaxBytes);
  if (code != 0) return code;

  if (outCell && *outCell) {
    SpiceCell *cell = (SpiceCell *)(*outCell);
    const int reg = tspice_registry_add(cell, 0, "tspice_new_int_cell()", err, errMaxBytes);
    if (reg != 0) {
      tspice_destroy_cell_storage(cell);
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
  if (!outCell) return tspice_return_error(err, errMaxBytes, "tspice_new_double_cell(): outCell must be non-null");
  *outCell = 0;


  SpiceInt sz = 0;
  if (tspice_int_to_spice_int_checked(size, &sz, "tspice_new_double_cell()", err, errMaxBytes) != 0) {
    return 1;
  }

  const int code = tspice_alloc_and_init_double_cell(sz, outCell, err, errMaxBytes);
  if (code != 0) return code;

  if (outCell && *outCell) {
    SpiceCell *cell = (SpiceCell *)(*outCell);
    const int reg = tspice_registry_add(cell, 0, "tspice_new_double_cell()", err, errMaxBytes);
    if (reg != 0) {
      tspice_destroy_cell_storage(cell);
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
  if (!outCell) return tspice_return_error(err, errMaxBytes, "tspice_new_char_cell(): outCell must be non-null");
  *outCell = 0;


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
    const int reg = tspice_registry_add(cell, 0, "tspice_new_char_cell()", err, errMaxBytes);
    if (reg != 0) {
      tspice_destroy_cell_storage(cell);
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
  if (!outWindow) return tspice_return_error(err, errMaxBytes, "tspice_new_window(): outWindow must be non-null");
  *outWindow = 0;


  if (maxIntervals < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_new_window(): maxIntervals must be >= 0");
  }
  if (maxIntervals > (INT_MAX / 2)) {
    return tspice_return_error(err, errMaxBytes, "tspice_new_window(): maxIntervals too large");
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
  const int reg = tspice_registry_add(window, 1, "tspice_new_window()", err, errMaxBytes);
  if (reg != 0) {
    tspice_destroy_cell_storage(window);
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

  tspice_destroy_cell_storage(cell);
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

  tspice_destroy_cell_storage(window);
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
    return tspice_return_error(err, errMaxBytes, "tspice_char_cell_length(): expected SPICE_CHR cell");
  }

  const SpiceInt length = cell->length;
  if (length <= 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_char_cell_length(): invalid cell length");
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

  if (tspice_validate_cell_capacity(cell, sz, "tspice_ssize()", err, errMaxBytes) != 0) return 1;
  ssize_c(sz, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  tspice_set_window_control_preserved(cell, 0);
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
  tspice_set_window_control_preserved(cell, 0);
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

  if (tspice_validate_cell_capacity(cell, sz, "tspice_valid()", err, errMaxBytes) != 0) return 1;
  valid_c(sz, nn, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  tspice_set_window_control_preserved(cell, 0);
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
    return tspice_return_error(err, errMaxBytes, "tspice_insrti(): expected SPICE_INT cell");
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
    return tspice_return_error(err, errMaxBytes, "tspice_insrtd(): expected SPICE_DP cell");
  }

  insrtd_c((SpiceDouble)item, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  tspice_set_window_control_preserved(cell, 0);
  return 0;
}

int tspice_insrtc(const char *item, uintptr_t cellHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (!item) {
    return tspice_return_error(err, errMaxBytes, "tspice_insrtc(): item must be non-null");
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_insrtc()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  if (cell->dtype != SPICE_CHR) {
    return tspice_return_error(err, errMaxBytes, "tspice_insrtc(): expected SPICE_CHR cell");
  }

  insrtc_c(item, cell);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

static int CellCallStatus(char *err, int errMaxBytes) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, errMaxBytes);
  return 1;
}

// copy_c reads numeric size/card from the translated control area. On
// CELLTOOSMALL the written cardinality there may differ from cell->card.
static int CheckCopyStorage(const SpiceCell *cell, char *err, int errMaxBytes) {
  if (cell->dtype == SPICE_CHR) {
    // C2F_MAP_CELL and the C string repacking loops use signed SpiceInt offsets.
    if (cell->length < 1 || cell->size > INT32_MAX - SPICE_CELL_CTRLSZ ||
        cell->size + SPICE_CELL_CTRLSZ > INT32_MAX / cell->length) {
      return tspice_return_error(err, errMaxBytes, "Character cell exceeds CSPICE copy workspace bounds");
    }
    return 0;
  }

  double size, card;
  if (cell->dtype == SPICE_DP) {
    const SpiceDouble *base = cell->base;
    size = base[SPICE_CELL_CTRLSZ - 2];
    card = base[SPICE_CELL_CTRLSZ - 1];
  } else {
    const SpiceInt *base = cell->base;
    size = base[SPICE_CELL_CTRLSZ - 2];
    card = base[SPICE_CELL_CTRLSZ - 1];
  }
  if (size != cell->size || !(card >= 0 && card <= size) || trunc(card) != card ||
      card > INT32_MAX - (SPICE_CELL_CTRLSZ - 1)) {
    return tspice_return_error(err, errMaxBytes, "Invalid numeric cell copy control or index bounds");
  }
  return 0;
}

int tspice_appndc(const char *item, uintptr_t handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  SpiceCell *cell = tspice_validate_ordinary_cell(handle, err, errMaxBytes);
  if (!cell) return 1;
  if (!item || strlen(item) >= INT32_MAX)
    return tspice_return_error(err, errMaxBytes, "Invalid cell item string or byte length");
  if (cell->dtype == SPICE_CHR && cell->card < cell->size) {
    if (cell->length < 1 || cell->card > INT32_MAX / cell->length)
      return tspice_return_error(err, errMaxBytes, "Character cell offset exceeds CSPICE index bounds");
    // appndc truncates to length-1 bytes. Reject a split scalar before mutation.
    const size_t limit = (size_t)cell->length - 1;
    if (strlen(item) > limit && (((unsigned char)item[limit] & 0xc0) == 0x80))
      return tspice_return_error(err, errMaxBytes, "Character cell width splits a UTF-8 scalar");
  }
  appndc_c(item, cell);
  return CellCallStatus(err, errMaxBytes);
}

int tspice_appndd(double item, uintptr_t handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  SpiceCell *cell = tspice_validate_ordinary_cell(handle, err, errMaxBytes);
  if (!cell) return 1;
  if (isnan(item)) return tspice_return_error(err, errMaxBytes, "Cell item must be an ordered number");
  appndd_c(item, cell);
  return CellCallStatus(err, errMaxBytes);
}

int tspice_appndi(int item, uintptr_t handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  SpiceCell *cell = tspice_validate_ordinary_cell(handle, err, errMaxBytes);
  if (!cell) return 1;
  appndi_c(item, cell);
  return CellCallStatus(err, errMaxBytes);
}

int tspice_elemc(const char *item, uintptr_t handle, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  SpiceCell *cell = tspice_validate_ordinary_cell(handle, err, errMaxBytes);
  if (!cell) return 1;
  if (!out) return tspice_return_error(err, errMaxBytes, "Missing cell membership output");
  if (!item || strlen(item) >= INT32_MAX)
    return tspice_return_error(err, errMaxBytes, "Invalid cell item string or byte length");
  if (cell->dtype == SPICE_CHR && cell->isSet && (cell->card > INT32_MAX / 2 + 1 || cell->length < 1 ||
       cell->card - 1 > INT32_MAX / cell->length))
    return tspice_return_error(err, errMaxBytes, "Cell exceeds CSPICE binary search index bounds");
  *out = elemc_c(item, cell) ? 1 : 0;
  return CellCallStatus(err, errMaxBytes);
}

int tspice_elemd(double item, uintptr_t handle, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  SpiceCell *cell = tspice_validate_ordinary_cell(handle, err, errMaxBytes);
  if (!cell) return 1;
  if (!out) return tspice_return_error(err, errMaxBytes, "Missing cell membership output");
  if (isnan(item)) return tspice_return_error(err, errMaxBytes, "Cell item must be an ordered number");
  if (cell->dtype == SPICE_DP && cell->isSet && cell->card > INT32_MAX / 2)
    return tspice_return_error(err, errMaxBytes, "Cell exceeds CSPICE binary search index bounds");
  *out = elemd_c(item, cell) ? 1 : 0;
  return CellCallStatus(err, errMaxBytes);
}

int tspice_elemi(int item, uintptr_t handle, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  SpiceCell *cell = tspice_validate_ordinary_cell(handle, err, errMaxBytes);
  if (!cell) return 1;
  if (!out) return tspice_return_error(err, errMaxBytes, "Missing cell membership output");
  if (cell->dtype == SPICE_INT && cell->isSet && cell->card > INT32_MAX / 2)
    return tspice_return_error(err, errMaxBytes, "Cell exceeds CSPICE binary search index bounds");
  *out = elemi_c(item, cell) ? 1 : 0;
  return CellCallStatus(err, errMaxBytes);
}

int tspice_copy(uintptr_t sourceHandle, uintptr_t destinationHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  SpiceCell *source = tspice_validate_ordinary_cell(sourceHandle, err, errMaxBytes);
  if (!source) return 1;
  SpiceCell *destination = tspice_validate_ordinary_cell(destinationHandle, err, errMaxBytes);
  if (!destination) return 1;
  // Mismatched types are diagnosed by copy_c before it touches either array.
  if (source->dtype == destination->dtype &&
      (CheckCopyStorage(source, err, errMaxBytes) || CheckCopyStorage(destination, err, errMaxBytes))) return 1;
  copy_c(source, destination);
  return CellCallStatus(err, errMaxBytes);
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
    return tspice_return_error(err, errMaxBytes, "tspice_cell_geti(): expected SPICE_INT cell");
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
    return tspice_return_error(err, errMaxBytes, "tspice_cell_geti(): index out of range");
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
    return tspice_return_error(err, errMaxBytes, "tspice_cell_getd(): expected SPICE_DP cell");
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
    return tspice_return_error(err, errMaxBytes, "tspice_cell_getd(): index out of range");
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
    return tspice_return_error(err, errMaxBytes, "tspice_cell_getc(): outMaxBytes must be > 0");
  }

  SpiceCell *cell = tspice_validate_handle(cellHandle, "cell", "tspice_cell_getc()", err, errMaxBytes);
  if (!cell) {
    return 1;
  }

  if (cell->dtype != SPICE_CHR) {
    return tspice_return_error(err, errMaxBytes, "tspice_cell_getc(): expected SPICE_CHR cell");
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
    return tspice_return_error(err, errMaxBytes, "tspice_cell_getc(): index out of range");
  }

  SPICE_CELL_GET_C(cell, idx, outMax, out);
  return 0;
}



// N0067's failed C window-result wrappers skip Fortran-to-C descriptor
// synchronization. Preserve the actual written range for subsequent window
// queries; card_c continues to expose the C descriptor cardinality.
static int PrepareWindowControl(SpiceCell *window, int *card, char *err, int errMaxBytes) {
  if (!tspice_preserves_window_control(window)) {
    window->init = SPICEFALSE;
    *card = window->card;
    return 0;
  }
  const double *base = window->base;
  const double size = base[SPICE_CELL_CTRLSZ - 2];
  const double written = base[SPICE_CELL_CTRLSZ - 1];
  if (size != window->size || !(written >= 0 && written <= size) ||
      written != trunc(written) || written > INT32_MAX - SPICE_CELL_CTRLSZ ||
      ((int)written % 2) != 0 ||
      tspice_validate_cell_capacity(window, window->size, "partial window", err, errMaxBytes)) {
    return tspice_return_error(err, errMaxBytes, "Invalid partial window control; reset the window cardinality");
  }
  window->init = SPICETRUE;
  *card = (int)written;
  return 0;
}

typedef enum { WINDOW_INPUT, WINDOW_RESULT, WINDOW_SUMMARY } WindowUse;

static SpiceCell *AlgebraWindow(uintptr_t handle, WindowUse use, char *err, int errMaxBytes) {
  SpiceCell *window = tspice_validate_window_kind(handle, err, errMaxBytes);
  if (!window) return NULL;
  // The translated routines address endpoints relative to a six-slot
  // control area. All pair writes must fit in an even result capacity.
  if (window->dtype != SPICE_DP || window->size < 0 || window->card < 0 ||
      window->card > window->size ||
      (use == WINDOW_RESULT && (window->size % 2 || window->size > INT32_MAX - SPICE_CELL_CTRLSZ)) ||
      (use != WINDOW_RESULT && window->card > INT32_MAX - SPICE_CELL_CTRLSZ)) {
    tspice_write_error(err, errMaxBytes, "Invalid window storage size or cardinality");
    return NULL;
  }
  if (tspice_validate_cell_capacity(window, window->size, "window algebra", err, errMaxBytes)) return NULL;
  int card = 0;
  if (PrepareWindowControl(window, &card, err, errMaxBytes)) return NULL;
  if (use != WINDOW_RESULT) {
    // WNSUMD diagnoses an odd cardinality before inspecting endpoints.
    if (card % 2) {
      if (use != WINDOW_SUMMARY) {
        tspice_write_error(err, errMaxBytes, "Window requires an even endpoint cardinality");
        return NULL;
      }
    } else {
      const double *data = window->data;
      for (int i = 0; i < card; i += 2) {
        if (!(data[i] <= data[i + 1]) || (i > 0 && !(data[i - 1] < data[i]))) {
          tspice_write_error(err, errMaxBytes, "Expected ordered, disjoint closed window intervals");
          return NULL;
        }
      }
    }
  }
  return window;
}

static int AlgebraCard(const SpiceCell *window) {
  if (!tspice_preserves_window_control(window)) return window->card;
  return (int)((const double *)window->base)[SPICE_CELL_CTRLSZ - 1];
}

int tspice_wncomd(
    double left, double right, uintptr_t windowHandle, uintptr_t resultHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!isfinite(left) || !isfinite(right)) return tspice_return_error(err, errMaxBytes, "Invalid window argument or output");
  if (resultHandle == windowHandle) return tspice_return_error(err, errMaxBytes, "Result window must be distinct from each input");
  SpiceCell *window = AlgebraWindow(windowHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!window) return 1;
  SpiceCell *result = AlgebraWindow(resultHandle, WINDOW_RESULT, err, errMaxBytes);
  if (!result) return 1;
  wncomd_c(left, right, window, result);
  if (failed_c()) {
    tspice_set_window_control_preserved(result, 1);
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  tspice_set_window_control_preserved(result, 0);
  return 0;
}

int tspice_wncond(
    double left, double right, uintptr_t windowHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!isfinite(left) || !isfinite(right)) return tspice_return_error(err, errMaxBytes, "Invalid window argument or output");
  SpiceCell *window = AlgebraWindow(windowHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!window) return 1;
  wncond_c(left, right, window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  tspice_set_window_control_preserved(window, 0);
  return 0;
}

int tspice_wndifd(
    uintptr_t aHandle, uintptr_t bHandle, uintptr_t resultHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (resultHandle == aHandle || resultHandle == bHandle) return tspice_return_error(err, errMaxBytes, "Result window must be distinct from each input");
  SpiceCell *a = AlgebraWindow(aHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!a) return 1;
  SpiceCell *b = AlgebraWindow(bHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!b) return 1;
  SpiceCell *result = AlgebraWindow(resultHandle, WINDOW_RESULT, err, errMaxBytes);
  if (!result) return 1;
  // Bound the translated signed32 excess/result endpoint counters.
  if ((int64_t)AlgebraCard(a) + AlgebraCard(b) > INT32_MAX)
    return tspice_return_error(err, errMaxBytes, "Combined window cardinality exceeds signed32");
  wndifd_c(a, b, result);
  if (failed_c()) {
    tspice_set_window_control_preserved(result, 1);
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  tspice_set_window_control_preserved(result, 0);
  return 0;
}

int tspice_wnelmd(
    double point, uintptr_t windowHandle, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!isfinite(point) || !out) return tspice_return_error(err, errMaxBytes, "Invalid window argument or output");
  SpiceCell *window = AlgebraWindow(windowHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!window) return 1;
  *out = wnelmd_c(point, window) ? 1 : 0;
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_wnexpd(
    double left, double right, uintptr_t windowHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!isfinite(left) || !isfinite(right)) return tspice_return_error(err, errMaxBytes, "Invalid window argument or output");
  SpiceCell *window = AlgebraWindow(windowHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!window) return 1;
  wnexpd_c(left, right, window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  tspice_set_window_control_preserved(window, 0);
  return 0;
}

int tspice_wnextd(
    int side, uintptr_t windowHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (side < 0 || side > 127) return tspice_return_error(err, errMaxBytes, "Invalid window argument or output");
  SpiceCell *window = AlgebraWindow(windowHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!window) return 1;
  wnextd_c((SpiceChar)side, window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_wnfild(
    double small, uintptr_t windowHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!isfinite(small)) return tspice_return_error(err, errMaxBytes, "Invalid window argument or output");
  SpiceCell *window = AlgebraWindow(windowHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!window) return 1;
  wnfild_c(small, window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  tspice_set_window_control_preserved(window, 0);
  return 0;
}

int tspice_wnfltd(
    double small, uintptr_t windowHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!isfinite(small)) return tspice_return_error(err, errMaxBytes, "Invalid window argument or output");
  SpiceCell *window = AlgebraWindow(windowHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!window) return 1;
  wnfltd_c(small, window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  tspice_set_window_control_preserved(window, 0);
  return 0;
}

int tspice_wnincd(
    double left, double right, uintptr_t windowHandle, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!isfinite(left) || !isfinite(right) || !out) return tspice_return_error(err, errMaxBytes, "Invalid window argument or output");
  SpiceCell *window = AlgebraWindow(windowHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!window) return 1;
  *out = wnincd_c(left, right, window) ? 1 : 0;
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_wnintd(
    uintptr_t aHandle, uintptr_t bHandle, uintptr_t resultHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (resultHandle == aHandle || resultHandle == bHandle) return tspice_return_error(err, errMaxBytes, "Result window must be distinct from each input");
  SpiceCell *a = AlgebraWindow(aHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!a) return 1;
  SpiceCell *b = AlgebraWindow(bHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!b) return 1;
  SpiceCell *result = AlgebraWindow(resultHandle, WINDOW_RESULT, err, errMaxBytes);
  if (!result) return 1;
  // Bound the translated signed32 excess/result endpoint counters.
  if ((int64_t)AlgebraCard(a) + AlgebraCard(b) > INT32_MAX)
    return tspice_return_error(err, errMaxBytes, "Combined window cardinality exceeds signed32");
  wnintd_c(a, b, result);
  if (failed_c()) {
    tspice_set_window_control_preserved(result, 1);
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  tspice_set_window_control_preserved(result, 0);
  return 0;
}

int tspice_wnreld(
    uintptr_t aHandle, const char *op, uintptr_t bHandle, int *out, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!out || !op) return tspice_return_error(err, errMaxBytes, "Invalid window argument or output");
  SpiceCell *a = AlgebraWindow(aHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!a) return 1;
  SpiceCell *b = AlgebraWindow(bHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!b) return 1;
  *out = wnreld_c(a, op, b) ? 1 : 0;
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_wnsumd(
    uintptr_t windowHandle, double *meas, double *avg, double *stddev, int *shortest, int *longest, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (!meas || !avg || !stddev || !shortest || !longest) return tspice_return_error(err, errMaxBytes, "Invalid window argument or output");
  SpiceCell *window = AlgebraWindow(windowHandle, WINDOW_SUMMARY, err, errMaxBytes);
  if (!window) return 1;
  // The C wrapper decrements both indices even on the odd-cardinality error.
  SpiceInt idxsml = 0, idxlon = 0;
  wnsumd_c(window, meas, avg, stddev, &idxsml, &idxlon);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *shortest = idxsml;
  *longest = idxlon;
  return 0;
}

int tspice_wnunid(
    uintptr_t aHandle, uintptr_t bHandle, uintptr_t resultHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  tspice_clear_error(err, errMaxBytes);
  if (resultHandle == aHandle || resultHandle == bHandle) return tspice_return_error(err, errMaxBytes, "Result window must be distinct from each input");
  SpiceCell *a = AlgebraWindow(aHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!a) return 1;
  SpiceCell *b = AlgebraWindow(bHandle, WINDOW_INPUT, err, errMaxBytes);
  if (!b) return 1;
  SpiceCell *result = AlgebraWindow(resultHandle, WINDOW_RESULT, err, errMaxBytes);
  if (!result) return 1;
  // Bound the translated signed32 excess/result endpoint counters.
  if ((int64_t)AlgebraCard(a) + AlgebraCard(b) > INT32_MAX)
    return tspice_return_error(err, errMaxBytes, "Combined window cardinality exceeds signed32");
  wnunid_c(a, b, result);
  if (failed_c()) {
    tspice_set_window_control_preserved(result, 1);
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  tspice_set_window_control_preserved(result, 0);
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
    return tspice_return_error(err, errMaxBytes, "tspice_wninsd(): expected SPICE_DP window");
  }

  int written = 0;
  if (PrepareWindowControl(window, &written, err, errMaxBytes)) return 1;

  wninsd_c((SpiceDouble)left, (SpiceDouble)right, window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  tspice_set_window_control_preserved(window, 0);
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
    return tspice_return_error(err, errMaxBytes, "tspice_wncard(): expected SPICE_DP window");
  }

  int written = 0;
  if (PrepareWindowControl(window, &written, err, errMaxBytes)) return 1;

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
    return tspice_return_error(err, errMaxBytes, "tspice_wnfetd(): expected SPICE_DP window");
  }

  SpiceInt idx = 0;
  if (tspice_int_to_spice_int_checked(index, &idx, "tspice_wnfetd()", err, errMaxBytes) != 0) {
    return 1;
  }

  int written = 0;
  if (PrepareWindowControl(window, &written, err, errMaxBytes)) return 1;

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
    return tspice_return_error(err, errMaxBytes, "tspice_wnvald(): expected SPICE_DP window");
  }

  SpiceInt sz = 0;
  SpiceInt nn = 0;
  if (tspice_int_to_spice_int_checked(size, &sz, "tspice_wnvald()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(n, &nn, "tspice_wnvald()", err, errMaxBytes) != 0) return 1;

  if (tspice_validate_cell_capacity(window, sz, "tspice_wnvald()", err, errMaxBytes) != 0) return 1;
  window->init = SPICEFALSE;

  wnvald_c(sz, nn, window);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  tspice_set_window_control_preserved(window, 0);
  return 0;
}
