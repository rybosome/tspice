#ifndef PARITY_CHECKING_GENERATED_NATIVE_RETURN_BINDINGS_H
#define PARITY_CHECKING_GENERATED_NATIVE_RETURN_BINDINGS_H

// GENERATED FILE - DO NOT EDIT.
// Source: packages/parity-checking/registry/functions.registry.yml

#include "generated/function_registry.h"

typedef enum {
  V2_NATIVE_RETURN_BINDING_NONE = 0,
  V2_NATIVE_RETURN_BINDING_EXPR_STRING_TO_JSON_STRING,
} V2NativeReturnBindingKind;

typedef const char *(*V2NativeReturnExprStringToJsonStringFn)(const char *value);

typedef struct {
  V2FunctionId fnId;
  const char *fnIdText;
  const char *cSymbol;
  V2NativeReturnBindingKind kind;
  V2NativeReturnExprStringToJsonStringFn exprStringToJsonStringFn;
} V2NativeReturnBindingEntry;

const V2NativeReturnBindingEntry *v2_lookup_native_return_binding(V2FunctionId fnId);

#endif
