#ifndef CSPICE_RUNNER_V2_CALL_SPEC_H
#define CSPICE_RUNNER_V2_CALL_SPEC_H

#include <stdint.h>

#include "cspice_runner_common.h"

typedef enum {
  V2_SPICE_CALL_NONE = 0,
  V2_SPICE_CALL_CARD_C,
  V2_SPICE_CALL_SIZE_C,
  V2_SPICE_CALL_SCARD_C,
  V2_SPICE_CALL_SSIZE_C,
  V2_SPICE_CALL_VALID_C,
  V2_SPICE_CALL_DSKOBJ_C,
  V2_SPICE_CALL_DSKSRF_C,
  V2_SPICE_CALL_DSKGD_C,
  V2_SPICE_CALL_DSKB02_C,
  V2_SPICE_CALL_DSKMI2_C,
  V2_SPICE_CALL_DSKOPN_C,
  V2_SPICE_CALL_DSKW02_C,
  V2_SPICE_CALL_READ_VIRTUAL_OUTPUT,
} V2SpiceCallId;

typedef enum {
  V2_SPICE_CALL_OUTPUT_FORBIDDEN = 0,
  V2_SPICE_CALL_OUTPUT_REQUIRED,
} V2SpiceCallOutputPolicy;

typedef struct {
  V2SpiceCallId id;
  const char *name;
  uint8_t arity;
  V2SpiceCallOutputPolicy outputPolicy;
} V2SpiceCallSpec;

const V2SpiceCallSpec *v2_lookup_spice_call_spec(const char *callName);

#endif
