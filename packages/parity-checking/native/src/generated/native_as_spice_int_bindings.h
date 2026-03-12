#ifndef PARITY_CHECKING_GENERATED_NATIVE_AS_SPICE_INT_BINDINGS_H
#define PARITY_CHECKING_GENERATED_NATIVE_AS_SPICE_INT_BINDINGS_H

// GENERATED FILE - DO NOT EDIT.
// Source: packages/parity-checking/catalogs/spice-function-registry.v2.yml

#include "cspice_runner_common.h"
#include "generated/function_registry.h"

typedef enum {
  V2_NATIVE_AS_SPICE_INT_BINDING_CELL_OR_WINDOW_REF_TO_SPICE_INT = 0,
} V2NativeAsSpiceIntBindingKind;

typedef SpiceInt (*V2NativeAsSpiceIntCellOrWindowRefToSpiceIntFn)(SpiceCell *cell);

typedef struct {
  V2FunctionId fnId;
  const char *fnIdText;
  const char *cSymbol;
  V2NativeAsSpiceIntBindingKind kind;
  V2NativeAsSpiceIntCellOrWindowRefToSpiceIntFn invokeFn;
} V2NativeAsSpiceIntBindingEntry;

const V2NativeAsSpiceIntBindingEntry *v2_lookup_native_as_spice_int_binding(V2FunctionId fnId);

#endif
