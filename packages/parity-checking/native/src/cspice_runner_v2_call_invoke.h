#ifndef CSPICE_RUNNER_V2_CALL_INVOKE_H
#define CSPICE_RUNNER_V2_CALL_INVOKE_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"
#include "cspice_runner_v2_refs.h"
#include "generated/function_registry.h"

typedef struct {
  SpiceInt intValues[V2_FUNCTION_MAX_ARITY];
  int refIndices[V2_FUNCTION_MAX_ARITY];
  char *pathValues[V2_FUNCTION_MAX_ARITY];
  int valueTokens[V2_FUNCTION_MAX_ARITY];
} V2ResolvedCallArgs;

typedef struct {
  const char *json;
  const jsmntok_t *tokens;
  int tokenCount;
  const char *fnName;
  const V2FunctionSpec *spec;
  int argsTok;
  const char *asRefName;
  int outMapTok;
  char **returnValueJson;
  V2ResolvedCallArgs *resolved;
  V2RefEntry *refs;
  int *refCount;
} V2CallInvokeContext;

bool v2_invoke_call(const V2CallInvokeContext *context);

#endif
