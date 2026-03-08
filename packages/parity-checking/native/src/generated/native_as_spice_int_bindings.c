// GENERATED FILE - DO NOT EDIT.
// Source: packages/parity-checking/registry/functions.registry.yml

#include "generated/native_as_spice_int_bindings.h"

#include <stddef.h>

static const V2NativeAsSpiceIntBindingEntry V2_NATIVE_AS_SPICE_INT_BINDINGS[] = {
  {
    V2_FUNCTION_ID_CELLS_WINDOWS_CARD,
    "cells-windows.card",
    "card_c",
    V2_NATIVE_AS_SPICE_INT_BINDING_CELL_OR_WINDOW_REF_TO_SPICE_INT,
    card_c,
  },
  {
    V2_FUNCTION_ID_CELLS_WINDOWS_SIZE,
    "cells-windows.size",
    "size_c",
    V2_NATIVE_AS_SPICE_INT_BINDING_CELL_OR_WINDOW_REF_TO_SPICE_INT,
    size_c,
  },
};

const V2NativeAsSpiceIntBindingEntry *v2_lookup_native_as_spice_int_binding(V2FunctionId fnId) {
  const size_t count = sizeof(V2_NATIVE_AS_SPICE_INT_BINDINGS) / sizeof(V2_NATIVE_AS_SPICE_INT_BINDINGS[0]);
  for (size_t i = 0; i < count; i++) {
    if (V2_NATIVE_AS_SPICE_INT_BINDINGS[i].fnId == fnId) {
      return &V2_NATIVE_AS_SPICE_INT_BINDINGS[i];
    }
  }

  return NULL;
}

