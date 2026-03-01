#ifndef CSPICE_RUNNER_V2_SPICE_INVOKE_H
#define CSPICE_RUNNER_V2_SPICE_INVOKE_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"
#include "cspice_runner_v2_call_spec.h"
#include "cspice_runner_v2_refs.h"

typedef struct {
  SpiceInt intValues[V2_SPICE_CALL_MAX_ARITY];
  int refIndices[V2_SPICE_CALL_MAX_ARITY];
  char *pathValues[V2_SPICE_CALL_MAX_ARITY];
} V2ResolvedSpiceCallArgs;

typedef struct {
  const char *json;
  const jsmntok_t *tokens;
  int tokenCount;
  const char *callName;
  const V2SpiceCallSpec *spec;
  const char *asRefName;
  int outMapTok;
  V2ResolvedSpiceCallArgs *resolved;
  V2RefEntry *refs;
  int *refCount;
} V2SpiceCallInvokeContext;

bool v2_invoke_spice_call(const V2SpiceCallInvokeContext *context);

#endif
