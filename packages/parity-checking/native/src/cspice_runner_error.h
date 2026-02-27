#ifndef CSPICE_RUNNER_ERROR_H
#define CSPICE_RUNNER_ERROR_H

#include "cspice_runner_common.h"

void write_unsupported_spiceint_width_error(void);
void capture_spice_error(char *shortMsg, size_t shortBytes,
                         char *longMsg, size_t longBytes,
                         char *traceMsg, size_t traceBytes);

#endif
