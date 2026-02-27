#ifndef CSPICE_RUNNER_IO_H
#define CSPICE_RUNNER_IO_H

#include "cspice_runner_common.h"

#define CSPICE_RUNNER_MAX_STDIN_BYTES (1024 * 1024)
#define MAX_BOD_ITEM_BYTES 1024
#define BODY_CONST_MAX_VALUES 1024

typedef enum {
  READ_STDIN_OK = 0,
  READ_STDIN_TOO_LARGE,
  READ_STDIN_OOM,
  READ_STDIN_IO,
  READ_STDIN_OVERFLOW,
} ReadStdinErr;

typedef enum {
  NORMALIZE_BOD_ITEM_OK = 0,
  NORMALIZE_BOD_ITEM_INVALID,
  NORMALIZE_BOD_ITEM_TOO_LONG,
  NORMALIZE_BOD_ITEM_OOM,
} normalize_bod_item_err_t;

ReadStdinErr read_all_stdin(char **outBuf, size_t *outLen);
bool is_ascii_whitespace(unsigned char c);
normalize_bod_item_err_t normalize_bod_item(const char *item, char **out);
void write_found_dla_descriptor_json(const SpiceDLADescr *descr,
                                     SpiceBoolean found);

#endif
