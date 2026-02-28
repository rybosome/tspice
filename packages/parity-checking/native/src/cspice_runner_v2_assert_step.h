#ifndef CSPICE_RUNNER_V2_ASSERT_STEP_H
#define CSPICE_RUNNER_V2_ASSERT_STEP_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"
#include "cspice_runner_v2_refs.h"

bool v2_execute_assert_step(const char *json, const jsmntok_t *tokens,
                            int tokenCount, int stepTok,
                            int argsTok, V2RefEntry *refs,
                            int refCount);

#endif
