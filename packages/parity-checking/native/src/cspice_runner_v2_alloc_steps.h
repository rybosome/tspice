#ifndef CSPICE_RUNNER_V2_ALLOC_STEPS_H
#define CSPICE_RUNNER_V2_ALLOC_STEPS_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"
#include "cspice_runner_v2_refs.h"

bool v2_execute_alloc_cell_step(const char *json, const jsmntok_t *tokens,
                                int tokenCount, int stepTok,
                                int argsTok, V2RefEntry *refs,
                                int *refCount);
bool v2_execute_alloc_window_step(const char *json, const jsmntok_t *tokens,
                                  int tokenCount, int stepTok,
                                  int argsTok, V2RefEntry *refs,
                                  int *refCount);
bool v2_execute_free_cell_step(const char *json, const jsmntok_t *tokens,
                               int tokenCount, int stepTok,
                               int argsTok, V2RefEntry *refs,
                               int refCount);
bool v2_execute_free_window_step(const char *json, const jsmntok_t *tokens,
                                 int tokenCount, int stepTok,
                                 int argsTok, V2RefEntry *refs,
                                 int refCount);

#endif
