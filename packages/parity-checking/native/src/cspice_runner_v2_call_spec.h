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

#define V2_SPICE_CALL_MAX_ARGS 3

typedef enum {
  V2_SPICE_CALL_EXEC_LEGACY = 0,
  V2_SPICE_CALL_EXEC_SIMPLE_SCALAR_INT,
  V2_SPICE_CALL_EXEC_SIMPLE_VOID,
  V2_SPICE_CALL_EXEC_COMPLEX,
} V2SpiceCallExecutionKind;

typedef enum {
  V2_SPICE_COMPLEX_CALL_NONE = 0,
  V2_SPICE_COMPLEX_CALL_MINIMAL_DSK_SELECTOR_INT,
  V2_SPICE_COMPLEX_CALL_MINIMAL_DSK_PRESENCE,
  V2_SPICE_COMPLEX_CALL_READ_VIRTUAL_OUTPUT_BYTES,
} V2SpiceComplexCallKind;

typedef enum {
  V2_SPICE_MINIMAL_DSK_SELECTOR_VALUE_NONE = 0,
  V2_SPICE_MINIMAL_DSK_SELECTOR_VALUE_DSKGD,
  V2_SPICE_MINIMAL_DSK_SELECTOR_VALUE_DSKB02,
} V2SpiceMinimalDskSelectorValueKind;

typedef enum {
  V2_SPICE_MINIMAL_DSK_PRESENCE_NONE = 0,
  V2_SPICE_MINIMAL_DSK_PRESENCE_BODY_ID,
  V2_SPICE_MINIMAL_DSK_PRESENCE_SURFACE_ID,
} V2SpiceMinimalDskPresenceKind;

typedef struct {
  V2SpiceComplexCallKind kind;
  const char *tempTag;
  V2SpiceMinimalDskSelectorValueKind selectorValueKind;
  const char *selectorPrimary;
  const char *selectorSecondary;
  V2SpiceMinimalDskPresenceKind presenceKind;
} V2SpiceComplexCallSpec;

typedef enum {
  V2_SPICE_CALL_ARG_NONE = 0,
  V2_SPICE_CALL_ARG_INT_EXPR,
  V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF,
} V2SpiceCallArgKind;

typedef struct {
  V2SpiceCallId id;
  const char *name;
  uint8_t arity;
  V2SpiceCallOutputPolicy outputPolicy;
  V2SpiceCallExecutionKind executionKind;
  V2SpiceComplexCallSpec complexCallSpec;
  V2SpiceCallArgKind argKinds[V2_SPICE_CALL_MAX_ARGS];
  unsigned int nonNegativeIntArgMask;
  int cellWritebackArgIndex;
  const char *arityErrorMessage;
  const char *missingOutputErrorMessage;
} V2SpiceCallSpec;

const V2SpiceCallSpec *v2_lookup_spice_call_spec(const char *callName);

#endif
