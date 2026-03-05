#ifndef CSPICE_RUNNER_V2_CALL_H
#define CSPICE_RUNNER_V2_CALL_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"
#include "cspice_runner_v2_refs.h"

bool v2_execute_call_step(const char *json, const jsmntok_t *tokens,
                          int tokenCount, int stepTok,
                          int argsTok, V2RefEntry *refs,
                          int *refCount);

#endif
