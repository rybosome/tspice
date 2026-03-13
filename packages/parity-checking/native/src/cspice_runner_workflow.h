#ifndef CSPICE_RUNNER_WORKFLOW_H
#define CSPICE_RUNNER_WORKFLOW_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"

bool execute_canonical_workflow_request(const char *json,
                                        const jsmntok_t *tokens,
                                        int tokenCount);

#endif
