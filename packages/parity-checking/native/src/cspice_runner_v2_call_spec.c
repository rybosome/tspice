#include "cspice_runner_v2_call_spec.h"

#include <string.h>

#define V2_LEGACY_CALL_SPEC(ID, NAME, ARITY, OUTPUT_POLICY)                  \
  {                                                                           \
      .id = (ID),                                                              \
      .name = (NAME),                                                          \
      .arity = (ARITY),                                                        \
      .outputPolicy = (OUTPUT_POLICY),                                         \
      .executionKind = V2_SPICE_CALL_EXEC_LEGACY,                             \
      .argKinds = {                                                            \
          V2_SPICE_CALL_ARG_NONE,                                              \
          V2_SPICE_CALL_ARG_NONE,                                              \
          V2_SPICE_CALL_ARG_NONE,                                              \
      },                                                                        \
      .nonNegativeIntArgMask = 0u,                                             \
      .cellWritebackArgIndex = -1,                                             \
      .arityErrorMessage = NULL,                                               \
      .missingOutputErrorMessage = NULL,                                       \
  }

#define V2_SIMPLE_SCALAR_INT_CALL_SPEC(ID, NAME, ARITY_MESSAGE, OUTPUT_MESSAGE) \
  {                                                                              \
      .id = (ID),                                                                 \
      .name = (NAME),                                                             \
      .arity = 1,                                                                 \
      .outputPolicy = V2_SPICE_CALL_OUTPUT_REQUIRED,                              \
      .executionKind = V2_SPICE_CALL_EXEC_SIMPLE_SCALAR_INT,                      \
      .argKinds = {                                                                \
          V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF,                                   \
          V2_SPICE_CALL_ARG_NONE,                                                 \
          V2_SPICE_CALL_ARG_NONE,                                                 \
      },                                                                           \
      .nonNegativeIntArgMask = 0u,                                                \
      .cellWritebackArgIndex = -1,                                                \
      .arityErrorMessage = (ARITY_MESSAGE),                                       \
      .missingOutputErrorMessage = (OUTPUT_MESSAGE),                              \
  }

#define V2_SIMPLE_VOID_CALL_SPEC(ID,                  \
                                 NAME,                \
                                 ARITY,               \
                                 ARG0_KIND,           \
                                 ARG1_KIND,           \
                                 ARG2_KIND,           \
                                 NONNEG_MASK,         \
                                 WRITEBACK_INDEX,     \
                                 ARITY_MESSAGE)       \
  {                                                    \
      .id = (ID),                                      \
      .name = (NAME),                                  \
      .arity = (ARITY),                                \
      .outputPolicy = V2_SPICE_CALL_OUTPUT_FORBIDDEN,  \
      .executionKind = V2_SPICE_CALL_EXEC_SIMPLE_VOID, \
      .argKinds = {                                    \
          (ARG0_KIND),                                 \
          (ARG1_KIND),                                 \
          (ARG2_KIND),                                 \
      },                                               \
      .nonNegativeIntArgMask = (NONNEG_MASK),         \
      .cellWritebackArgIndex = (WRITEBACK_INDEX),     \
      .arityErrorMessage = (ARITY_MESSAGE),            \
      .missingOutputErrorMessage = NULL,               \
  }

const V2SpiceCallSpec *v2_lookup_spice_call_spec(const char *callName) {
  static const V2SpiceCallSpec table[] = {
      V2_SIMPLE_SCALAR_INT_CALL_SPEC(V2_SPICE_CALL_CARD_C,
                                     "card_c",
                                     "spiceCall card_c/size_c expects one input",
                                     "spiceCall card_c/size_c requires string as"),
      V2_SIMPLE_SCALAR_INT_CALL_SPEC(V2_SPICE_CALL_SIZE_C,
                                     "size_c",
                                     "spiceCall card_c/size_c expects one input",
                                     "spiceCall card_c/size_c requires string as"),
      V2_SIMPLE_VOID_CALL_SPEC(V2_SPICE_CALL_SCARD_C,
                               "scard_c",
                               2,
                               V2_SPICE_CALL_ARG_INT_EXPR,
                               V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF,
                               V2_SPICE_CALL_ARG_NONE,
                               (1u << 0),
                               1,
                               "spiceCall scard_c expects [card, cellOrWindow]"),
      V2_SIMPLE_VOID_CALL_SPEC(V2_SPICE_CALL_SSIZE_C,
                               "ssize_c",
                               2,
                               V2_SPICE_CALL_ARG_INT_EXPR,
                               V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF,
                               V2_SPICE_CALL_ARG_NONE,
                               (1u << 0),
                               1,
                               "spiceCall ssize_c expects [size, cellOrWindow]"),
      V2_SIMPLE_VOID_CALL_SPEC(V2_SPICE_CALL_VALID_C,
                               "valid_c",
                               3,
                               V2_SPICE_CALL_ARG_INT_EXPR,
                               V2_SPICE_CALL_ARG_INT_EXPR,
                               V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF,
                               (1u << 0) | (1u << 1),
                               2,
                               "spiceCall valid_c expects [size, n, cellOrWindow]"),
      V2_LEGACY_CALL_SPEC(V2_SPICE_CALL_DSKOBJ_C,
                          "dskobj_c",
                          0,
                          V2_SPICE_CALL_OUTPUT_FORBIDDEN),
      V2_LEGACY_CALL_SPEC(V2_SPICE_CALL_DSKSRF_C,
                          "dsksrf_c",
                          0,
                          V2_SPICE_CALL_OUTPUT_FORBIDDEN),
      V2_LEGACY_CALL_SPEC(V2_SPICE_CALL_DSKGD_C,
                          "dskgd_c",
                          1,
                          V2_SPICE_CALL_OUTPUT_REQUIRED),
      V2_LEGACY_CALL_SPEC(V2_SPICE_CALL_DSKB02_C,
                          "dskb02_c",
                          1,
                          V2_SPICE_CALL_OUTPUT_REQUIRED),
      V2_LEGACY_CALL_SPEC(V2_SPICE_CALL_DSKMI2_C,
                          "dskmi2_c",
                          0,
                          V2_SPICE_CALL_OUTPUT_FORBIDDEN),
      V2_LEGACY_CALL_SPEC(V2_SPICE_CALL_DSKOPN_C,
                          "dskopn_c",
                          0,
                          V2_SPICE_CALL_OUTPUT_FORBIDDEN),
      V2_LEGACY_CALL_SPEC(V2_SPICE_CALL_DSKW02_C,
                          "dskw02_c",
                          0,
                          V2_SPICE_CALL_OUTPUT_FORBIDDEN),
      V2_LEGACY_CALL_SPEC(V2_SPICE_CALL_READ_VIRTUAL_OUTPUT,
                          "readVirtualOutput",
                          0,
                          V2_SPICE_CALL_OUTPUT_FORBIDDEN),
  };

  if (callName == NULL) {
    return NULL;
  }

  for (size_t i = 0; i < sizeof(table) / sizeof(table[0]); i++) {
    if (strcmp(callName, table[i].name) == 0) {
      return &table[i];
    }
  }

  return NULL;
}

#undef V2_LEGACY_CALL_SPEC
#undef V2_SIMPLE_SCALAR_INT_CALL_SPEC
#undef V2_SIMPLE_VOID_CALL_SPEC
