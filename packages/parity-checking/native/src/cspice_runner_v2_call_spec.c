#include "cspice_runner_v2_call_spec.h"

const V2SpiceCallSpec *v2_lookup_spice_call_spec(const char *callName) {
  static const V2SpiceCallSpec table[] = {
      {V2_SPICE_CALL_CARD_C, "card_c", 1, V2_SPICE_CALL_OUTPUT_REQUIRED},
      {V2_SPICE_CALL_SIZE_C, "size_c", 1, V2_SPICE_CALL_OUTPUT_REQUIRED},
      {V2_SPICE_CALL_SCARD_C, "scard_c", 2, V2_SPICE_CALL_OUTPUT_FORBIDDEN},
      {V2_SPICE_CALL_SSIZE_C, "ssize_c", 2, V2_SPICE_CALL_OUTPUT_FORBIDDEN},
      {V2_SPICE_CALL_VALID_C, "valid_c", 3, V2_SPICE_CALL_OUTPUT_FORBIDDEN},
      {V2_SPICE_CALL_DSKOBJ_C, "dskobj_c", 0, V2_SPICE_CALL_OUTPUT_FORBIDDEN},
      {V2_SPICE_CALL_DSKSRF_C, "dsksrf_c", 0, V2_SPICE_CALL_OUTPUT_FORBIDDEN},
      {V2_SPICE_CALL_DSKGD_C, "dskgd_c", 1, V2_SPICE_CALL_OUTPUT_REQUIRED},
      {V2_SPICE_CALL_DSKB02_C, "dskb02_c", 1, V2_SPICE_CALL_OUTPUT_REQUIRED},
      {V2_SPICE_CALL_DSKMI2_C, "dskmi2_c", 0, V2_SPICE_CALL_OUTPUT_FORBIDDEN},
      {V2_SPICE_CALL_DSKOPN_C, "dskopn_c", 0, V2_SPICE_CALL_OUTPUT_FORBIDDEN},
      {V2_SPICE_CALL_DSKW02_C, "dskw02_c", 0, V2_SPICE_CALL_OUTPUT_FORBIDDEN},
      {V2_SPICE_CALL_READ_VIRTUAL_OUTPUT,
       "readVirtualOutput",
       0,
       V2_SPICE_CALL_OUTPUT_FORBIDDEN},
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
