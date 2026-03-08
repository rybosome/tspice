#ifndef PARITY_CHECKING_GENERATED_NATIVE_RETURN_BINDINGS_H
#define PARITY_CHECKING_GENERATED_NATIVE_RETURN_BINDINGS_H

// GENERATED FILE - DO NOT EDIT.
// Source: packages/parity-checking/registry/functions.registry.yml

#include "cspice_runner_common.h"
#include "generated/function_registry.h"

typedef enum {
  V2_NATIVE_RETURN_BINDING_GENERATED_RETURN_BINDING_LANE = 0,
  V2_NATIVE_RETURN_BINDING_EXPR_STRING_TO_JSON_STRING,
  V2_NATIVE_RETURN_BINDING_EXPR_SPICE_INT_TO_JSON_STRING_VIA_SIZED_OUT_BUFFER,
} V2NativeReturnBindingKind;

typedef const char *(*V2NativeReturnExprStringToJsonStringFn)(const char *value);
typedef void (*V2NativeReturnExprSpiceIntToJsonStringViaSizedOutBufferFn)(SpiceInt code, SpiceInt outMaxBytes, SpiceChar *outValue);

typedef struct {
  V2FunctionId fnId;
  const char *fnIdText;
  const char *cSymbol;
  V2NativeReturnBindingKind kind;
  V2NativeReturnExprStringToJsonStringFn exprStringToJsonStringFn;
  V2NativeReturnExprSpiceIntToJsonStringViaSizedOutBufferFn exprSpiceIntToJsonStringViaSizedOutBufferFn;
} V2NativeReturnBindingEntry;

const V2NativeReturnBindingEntry *v2_lookup_native_return_binding(V2FunctionId fnId);

#endif
