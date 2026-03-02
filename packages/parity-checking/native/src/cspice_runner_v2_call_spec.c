#include "cspice_runner_v2_call_spec.h"

#define SPEC_ROW(_id, _name, _arity, _nonNegMask, _outKind, ...) \
  {                                                                \
      .id = (_id),                                                 \
      .name = (_name),                                             \
      .arity = (_arity),                                           \
      .argKinds = {__VA_ARGS__},                                   \
      .nonNegativeIntArgMask = (_nonNegMask),                      \
      .outputKind = (_outKind),                                    \
  }

static const V2SpiceCallSpec V2_SPICE_CALL_SPECS[] = {
    SPEC_ROW(V2_SPICE_CALL_CARD,
             "card_c",
             1,
             0U,
             V2_SPICE_CALL_OUTPUT_AS_INT,
             V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF),

    SPEC_ROW(V2_SPICE_CALL_SIZE,
             "size_c",
             1,
             0U,
             V2_SPICE_CALL_OUTPUT_AS_INT,
             V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF),

    SPEC_ROW(V2_SPICE_CALL_SCARD,
             "scard_c",
             2,
             1U << 0,
             V2_SPICE_CALL_OUTPUT_FORBIDDEN,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF),

    SPEC_ROW(V2_SPICE_CALL_SSIZE,
             "ssize_c",
             2,
             1U << 0,
             V2_SPICE_CALL_OUTPUT_FORBIDDEN,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF),

    SPEC_ROW(V2_SPICE_CALL_VALID,
             "valid_c",
             3,
             (1U << 0) | (1U << 1),
             V2_SPICE_CALL_OUTPUT_FORBIDDEN,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF),

    SPEC_ROW(V2_SPICE_CALL_DSKOBJ,
             "dskobj_c",
             2,
             0U,
             V2_SPICE_CALL_OUTPUT_FORBIDDEN,
             V2_SPICE_CALL_ARG_PATH_EXPR,
             V2_SPICE_CALL_ARG_CELL_REF),

    SPEC_ROW(V2_SPICE_CALL_DSKSRF,
             "dsksrf_c",
             3,
             0U,
             V2_SPICE_CALL_OUTPUT_FORBIDDEN,
             V2_SPICE_CALL_ARG_PATH_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_CELL_REF),

    SPEC_ROW(V2_SPICE_CALL_DSKGD,
             "dskgd_c",
             2,
             0U,
             V2_SPICE_CALL_OUTPUT_AS_DSK_DESCR,
             V2_SPICE_CALL_ARG_DAS_HANDLE_REF,
             V2_SPICE_CALL_ARG_DLA_DESCR_REF),

    SPEC_ROW(V2_SPICE_CALL_DSKB02,
             "dskb02_c",
             2,
             0U,
             V2_SPICE_CALL_OUTPUT_NAMED_DSKB02,
             V2_SPICE_CALL_ARG_DAS_HANDLE_REF,
             V2_SPICE_CALL_ARG_DLA_DESCR_REF),

    SPEC_ROW(V2_SPICE_CALL_DSKOPN,
             "dskopn_c",
             3,
             1U << 2,
             V2_SPICE_CALL_OUTPUT_AS_DAS_HANDLE,
             V2_SPICE_CALL_ARG_PATH_EXPR,
             V2_SPICE_CALL_ARG_STRING_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR),

    SPEC_ROW(V2_SPICE_CALL_DSKMI2,
             "dskmi2_c",
             11,
             (1U << 0) | (1U << 2) | (1U << 5) | (1U << 6) | (1U << 7) |
                 (1U << 8) | (1U << 10),
             V2_SPICE_CALL_OUTPUT_NAMED_DSKMI2,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_ARRAY_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_INT_ARRAY_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_BOOLEAN_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR),

    SPEC_ROW(V2_SPICE_CALL_DSKW02,
             "dskw02_c",
             21,
             (1U << 15) | (1U << 17),
             V2_SPICE_CALL_OUTPUT_FORBIDDEN,
             V2_SPICE_CALL_ARG_DAS_HANDLE_REF,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_STRING_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_ARRAY_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_ARRAY_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_INT_ARRAY_EXPR,
             V2_SPICE_CALL_ARG_DOUBLE_ARRAY_EXPR,
             V2_SPICE_CALL_ARG_INT_ARRAY_EXPR),

    SPEC_ROW(V2_SPICE_CALL_READ_VIRTUAL_OUTPUT,
             "readVirtualOutput",
             1,
             0U,
             V2_SPICE_CALL_OUTPUT_FORBIDDEN,
             V2_SPICE_CALL_ARG_PATH_EXPR),
};

#undef SPEC_ROW

const V2SpiceCallSpec *v2_lookup_spice_call_spec(const char *name) {
  const int count = (int)(sizeof(V2_SPICE_CALL_SPECS) / sizeof(V2_SPICE_CALL_SPECS[0]));
  for (int i = 0; i < count; i++) {
    if (strcmp(V2_SPICE_CALL_SPECS[i].name, name) == 0) {
      return &V2_SPICE_CALL_SPECS[i];
    }
  }

  return NULL;
}
