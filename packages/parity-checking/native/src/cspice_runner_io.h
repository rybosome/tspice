#ifndef CSPICE_RUNNER_IO_H
#define CSPICE_RUNNER_IO_H

#include "cspice_runner_common.h"

#define CSPICE_RUNNER_MAX_STDIN_BYTES (1024 * 1024)

typedef enum {
  READ_STDIN_OK = 0,
  READ_STDIN_TOO_LARGE,
  READ_STDIN_OOM,
  READ_STDIN_IO,
  READ_STDIN_OVERFLOW,
} ReadStdinErr;

ReadStdinErr read_all_stdin(char **outBuf, size_t *outLen);

#endif
