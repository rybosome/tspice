#ifndef CSPICE_RUNNER_V2_WORKFLOW_H
#define CSPICE_RUNNER_V2_WORKFLOW_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"
#include "cspice_runner_v2_refs.h"

bool v2_dispatch_workflow_step(const char *json, const jsmntok_t *tokens,
                               int tokenCount, int stepTok, int opTok,
                               int argsTok, V2RefEntry *refs, int *refCount,
                               bool captureProjectResult,
                               char **projectResultObjectJson,
                               const char *unsupportedOpMessage);
bool v2_execute_workflow_request(const char *json, const jsmntok_t *tokens,
                                 int tokenCount);

#endif
