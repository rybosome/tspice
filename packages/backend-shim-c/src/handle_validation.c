#include "handle_validation.h"

#include "tspice_error.h"

#include <inttypes.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  uintptr_t handle;
  SpiceInt capacity;
  uint64_t generation;
} tspice_cell_registry_entry;

typedef struct {
  tspice_cell_registry_entry *items;
  size_t len;
  size_t cap;
} tspice_cell_registry;

// NOTE: This registry is process-global and intentionally simple.
//
// We store raw pointer values (`uintptr_t`) in a sorted array so we can do
// O(log n) membership checks via binary search.
// It validates live handles and retains original backing capacities independently
// of mutable SpiceCell.size values.
//
// Concurrency: not thread-safe. Callers must ensure no concurrent access
// (e.g. the Node addon serializes CSPICE/shim calls with a mutex; WASM is
// single-threaded).
static tspice_cell_registry tspice_cells_registry = {0};

static size_t tspice_registry_lower_bound(uintptr_t handle, int *outFound) {
  size_t lo = 0;
  size_t hi = tspice_cells_registry.len;

  while (lo < hi) {
    const size_t mid = lo + ((hi - lo) / 2);
    const uintptr_t v = tspice_cells_registry.items[mid].handle;

    if (v < handle) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  if (outFound) {
    *outFound = (lo < tspice_cells_registry.len && tspice_cells_registry.items[lo].handle == handle) ? 1 : 0;
  }
  return lo;
}

static int tspice_registry_contains(uintptr_t handle) {
  if (handle == 0) return 0;
  int found = 0;
  (void)tspice_registry_lower_bound(handle, &found);
  return found;
}

uint64_t tspice_registry_generation(uintptr_t handle) {
  int found=0; size_t idx=tspice_registry_lower_bound(handle,&found);
  return found?tspice_cells_registry.items[idx].generation:0;
}

int tspice_registry_add(SpiceCell *cell, const char *ctx, char *err, int errMaxBytes) {
  if (!cell) {
    return tspice_return_error(err, errMaxBytes, "tspice_registry_add(): cell must be non-null");
  }

  const uintptr_t handle = (uintptr_t)cell;
  int found = 0;
  const size_t idx = tspice_registry_lower_bound(handle, &found);
  if (found) {
    return 0;
  }

  if (tspice_cells_registry.len == tspice_cells_registry.cap) {
    const size_t nextCap = tspice_cells_registry.cap == 0 ? 16 : tspice_cells_registry.cap * 2;
    tspice_cell_registry_entry *next = (tspice_cell_registry_entry *)realloc(
        tspice_cells_registry.items, nextCap * sizeof(tspice_cell_registry_entry));
    if (!next) {
      char buf[160];
      snprintf(buf, sizeof(buf), "%s: failed to grow cell registry", ctx);
      return tspice_return_error(err, errMaxBytes, buf);
    }
    tspice_cells_registry.items = next;
    tspice_cells_registry.cap = nextCap;
  }

  // Insert to keep the array sorted.
  if (idx < tspice_cells_registry.len) {
    memmove(
        &tspice_cells_registry.items[idx + 1],
        &tspice_cells_registry.items[idx],
        (tspice_cells_registry.len - idx) * sizeof(tspice_cell_registry_entry));
  }
  static uint64_t next_generation = 0;
  tspice_cells_registry.items[idx].generation = ++next_generation;
  tspice_cells_registry.items[idx].handle = handle;
  tspice_cells_registry.items[idx].capacity = cell->size;
  tspice_cells_registry.len++;

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

  tspice_cell_registry_entry *next = (tspice_cell_registry_entry *)realloc(
        tspice_cells_registry.items, nextCap * sizeof(tspice_cell_registry_entry));
  if (!next) {
    // Best-effort: if shrinking fails, keep the current allocation.
    return;
  }
  tspice_cells_registry.items = next;
  tspice_cells_registry.cap = nextCap;
}

int tspice_registry_remove(SpiceCell *cell) {
  if (!cell) return 0;

  const uintptr_t handle = (uintptr_t)cell;
  int found = 0;
  const size_t idx = tspice_registry_lower_bound(handle, &found);
  if (!found) {
    return 0;
  }

  // Remove while keeping the array sorted.
  if (idx + 1 < tspice_cells_registry.len) {
    memmove(
        &tspice_cells_registry.items[idx],
        &tspice_cells_registry.items[idx + 1],
        (tspice_cells_registry.len - idx - 1) * sizeof(tspice_cell_registry_entry));
  }
  tspice_cells_registry.len--;
  tspice_registry_maybe_shrink();
  return 1;
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

  if (!tspice_registry_contains(handle)) {
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

  return (SpiceCell *)handle;
}

int tspice_validate_cell_capacity(
    SpiceCell *cell,
    SpiceInt size,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  int found = 0;
  const size_t idx = tspice_registry_lower_bound((uintptr_t)cell, &found);
  if (!found) {
    return tspice_return_error(err, errMaxBytes, "Cell capacity lookup requires a registered handle");
  }
  if (size > tspice_cells_registry.items[idx].capacity) {
    char buf[220];
    snprintf(buf, sizeof(buf), "%s: size exceeds allocated cell capacity (%" PRIdMAX ")",
        ctx, (intmax_t)tspice_cells_registry.items[idx].capacity);
    return tspice_return_error(err, errMaxBytes, buf);
  }
  return 0;
}
