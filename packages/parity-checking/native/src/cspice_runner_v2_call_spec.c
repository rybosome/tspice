#include "cspice_runner_v2_call_spec.h"

#define ARG_UNUSED V2_SPICE_CALL_ARG_INT_EXPR

#define SPEC_ROW(_id, _name, _arity, _k0, _k1, _k2, _nonNegMask, _outKind) \
  {                                                                      \
      .id = (_id),                                                       \
      .name = (_name),                                                   \
      .arity = (_arity),                                                 \
      .argKinds = {(_k0), (_k1), (_k2)},                                 \
      .nonNegativeIntArgMask = (_nonNegMask),                            \
      .outputKind = (_outKind),                                          \
  }

static const V2SpiceCallSpec V2_SPICE_CALL_SPECS[] = {
    SPEC_ROW(V2_SPICE_CALL_CARD,
             "card_c",
             1,
             V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF,
             ARG_UNUSED,
             ARG_UNUSED,
             0U,
             V2_SPICE_CALL_OUTPUT_AS_INT),

    SPEC_ROW(V2_SPICE_CALL_SIZE,
             "size_c",
             1,
             V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF,
             ARG_UNUSED,
             ARG_UNUSED,
             0U,
             V2_SPICE_CALL_OUTPUT_AS_INT),

    SPEC_ROW(V2_SPICE_CALL_SCARD,
             "scard_c",
             2,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF,
             ARG_UNUSED,
             1U << 0,
             V2_SPICE_CALL_OUTPUT_FORBIDDEN),

    SPEC_ROW(V2_SPICE_CALL_SSIZE,
             "ssize_c",
             2,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF,
             ARG_UNUSED,
             1U << 0,
             V2_SPICE_CALL_OUTPUT_FORBIDDEN),

    SPEC_ROW(V2_SPICE_CALL_VALID,
             "valid_c",
             3,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF,
             (1U << 0) | (1U << 1),
             V2_SPICE_CALL_OUTPUT_FORBIDDEN),

    SPEC_ROW(V2_SPICE_CALL_DSKOBJ,
             "dskobj_c",
             2,
             V2_SPICE_CALL_ARG_PATH_EXPR,
             V2_SPICE_CALL_ARG_CELL_REF,
             ARG_UNUSED,
             0U,
             V2_SPICE_CALL_OUTPUT_FORBIDDEN),

    SPEC_ROW(V2_SPICE_CALL_DSKSRF,
             "dsksrf_c",
             3,
             V2_SPICE_CALL_ARG_PATH_EXPR,
             V2_SPICE_CALL_ARG_INT_EXPR,
             V2_SPICE_CALL_ARG_CELL_REF,
             0U,
             V2_SPICE_CALL_OUTPUT_FORBIDDEN),

    SPEC_ROW(V2_SPICE_CALL_DSKGD,
             "dskgd_c",
             2,
             V2_SPICE_CALL_ARG_DAS_HANDLE_REF,
             V2_SPICE_CALL_ARG_DLA_DESCR_REF,
             ARG_UNUSED,
             0U,
             V2_SPICE_CALL_OUTPUT_AS_DSK_DESCR),

    SPEC_ROW(V2_SPICE_CALL_DSKB02,
             "dskb02_c",
             2,
             V2_SPICE_CALL_ARG_DAS_HANDLE_REF,
             V2_SPICE_CALL_ARG_DLA_DESCR_REF,
             ARG_UNUSED,
             0U,
             V2_SPICE_CALL_OUTPUT_NAMED_DSKB02),
};

#undef SPEC_ROW
#undef ARG_UNUSED

const V2SpiceCallSpec *v2_lookup_spice_call_spec(const char *name) {
  const int count = (int)(sizeof(V2_SPICE_CALL_SPECS) / sizeof(V2_SPICE_CALL_SPECS[0]));
  for (int i = 0; i < count; i++) {
    if (strcmp(V2_SPICE_CALL_SPECS[i].name, name) == 0) {
      return &V2_SPICE_CALL_SPECS[i];
    }
  }

  return NULL;
}
