#include "handle_validation.h"

#include <inttypes.h>
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

typedef struct {
  SpiceCell **items;
  size_t len;
  size_t cap;
} tspice_cell_registry;

// NOTE: This registry is process-global and intentionally simple (a linear list).
// It is used only to validate handles and prevent use-after-free.
//
// Concurrency: not thread-safe. Callers must ensure no concurrent access
// (e.g. the Node addon serializes CSPICE/shim calls with a mutex; WASM is
// single-threaded).
static tspice_cell_registry tspice_cells_registry = {0};

static int tspice_registry_contains(SpiceCell *cell) {
  if (!cell) return 0;
  for (size_t i = 0; i < tspice_cells_registry.len; i++) {
    if (tspice_cells_registry.items[i] == cell) return 1;
  }
  return 0;
}

int tspice_registry_add(SpiceCell *cell, const char *ctx, char *err, int errMaxBytes) {
  if (!cell) {
    return tspice_write_error(err, errMaxBytes, "tspice_registry_add(): cell must be non-null");
  }
  if (tspice_registry_contains(cell)) {
    return 0;
  }
  if (tspice_cells_registry.len == tspice_cells_registry.cap) {
    const size_t nextCap = tspice_cells_registry.cap == 0 ? 16 : tspice_cells_registry.cap * 2;
    SpiceCell **next = (SpiceCell **)realloc(tspice_cells_registry.items, nextCap * sizeof(SpiceCell *));
    if (!next) {
      char buf[160];
      snprintf(buf, sizeof(buf), "%s: failed to grow cell registry", ctx);
      return tspice_write_error(err, errMaxBytes, buf);
    }
    tspice_cells_registry.items = next;
    tspice_cells_registry.cap = nextCap;
  }
  tspice_cells_registry.items[tspice_cells_registry.len++] = cell;
  return 0;
}

static void tspice_registry_maybe_shrink(void) {
  if (tspice_cells_registry.cap == 0) return;

  // If the registry is empty, release memory eagerly.
  if (tspice_cells_registry.len == 0) {
    free(tspice_cells_registry.items);
    tspice_cells_registry.items = NULL;
    tspice_cells_registry.cap = 0;
    return;
  }

  // Best-effort shrink to avoid unbounded growth over long-lived processes.
  // Keep a small floor to avoid frequent realloc churn.
  if (tspice_cells_registry.cap <= 64) return;
  if (tspice_cells_registry.len * 4 > tspice_cells_registry.cap) return;

  size_t nextCap = tspice_cells_registry.cap / 2;
  if (nextCap < 16) nextCap = 16;
  if (nextCap < tspice_cells_registry.len) nextCap = tspice_cells_registry.len;

  SpiceCell **next = (SpiceCell **)realloc(tspice_cells_registry.items, nextCap * sizeof(SpiceCell *));
  if (!next) {
    // Best-effort: if shrinking fails, keep the current allocation.
    return;
  }
  tspice_cells_registry.items = next;
  tspice_cells_registry.cap = nextCap;
}

int tspice_registry_remove(SpiceCell *cell) {
  if (!cell) return 0;
  for (size_t i = 0; i < tspice_cells_registry.len; i++) {
    if (tspice_cells_registry.items[i] == cell) {
      tspice_cells_registry.items[i] = tspice_cells_registry.items[tspice_cells_registry.len - 1];
      tspice_cells_registry.len--;
      tspice_registry_maybe_shrink();
      return 1;
    }
  }
  return 0;
}

SpiceCell *tspice_validate_handle(
    uintptr_t handle,
    const char *kind,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  if (handle == 0) {
    char buf[160];
    snprintf(buf, sizeof(buf), "%s: %s handle must be non-null", ctx, kind);
    tspice_write_error(err, errMaxBytes, buf);
    return NULL;
  }

  SpiceCell *cell = (SpiceCell *)handle;
  if (!tspice_registry_contains(cell)) {
    char buf[200];
    snprintf(
        buf,
        sizeof(buf),
        "%s: unknown/expired %s handle (%" PRIuPTR ")",
        ctx,
        kind,
        handle);
    tspice_write_error(err, errMaxBytes, buf);
    return NULL;
  }

  return cell;
}
