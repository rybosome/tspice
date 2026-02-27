#ifndef CSPICE_RUNNER_TEMP_FILES_H
#define CSPICE_RUNNER_TEMP_FILES_H

#include "cspice_runner_common.h"

void sanitize_file_io_temp_tag(const char *tag, char *out, size_t outBytes);
bool build_file_io_temp_path(const char *tag, const char *extension,
                             char *outPath, size_t outPathBytes,
                             int *outFd, char *detail,
                             size_t detailBytes);

#endif
