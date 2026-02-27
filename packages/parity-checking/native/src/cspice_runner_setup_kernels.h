#ifndef CSPICE_RUNNER_SETUP_KERNELS_H
#define CSPICE_RUNNER_SETUP_KERNELS_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"

bool apply_setup_kernels(const char *input, const jsmntok_t *tokens,
                         int tokenCount, int setupTok, int *exitCode);

#endif
