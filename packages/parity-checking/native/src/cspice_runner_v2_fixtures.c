#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_temp_files.h"
#include "cspice_runner_v2_fixtures.h"

const SpiceDouble DSK_MINIMAL_VERTICES[DSK_MINIMAL_NV][3] = {
    {0.0, 0.0, 0.0},
    {1.0, 0.0, 0.0},
    {0.0, 1.0, 0.0},
};

const SpiceInt DSK_MINIMAL_PLATES[DSK_MINIMAL_NP][3] = {
    {1, 2, 3},
};

const SpiceDouble DSK_MINIMAL_CORPAR[SPICE_DSK_NSYPAR] = {
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
};

const SpiceDouble READ_VIRTUAL_OUTPUT_STATES[2][6] = {
    {0.0, 0.0, 0.0, 1.0, 0.0, 0.0},
    {60.0, 0.0, 0.0, 1.0, 0.0, 0.0},
};

bool v2_write_minimal_dsk_file(const char *tag,
                                      char *outPath,
                                      size_t outPathBytes) {
  char detail[256];
  detail[0] = '\0';

  int tempFd = -1;
  if (!build_file_io_temp_path(tag,
                               ".bds",
                               outPath,
                               outPathBytes,
                               &tempFd,
                               detail,
                               sizeof(detail))) {
    write_error_json_ex("invalid_request",
                        "Failed to create temporary DSK path",
                        detail[0] ? detail : NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  if (tempFd >= 0) {
    close(tempFd);
    tempFd = -1;
  }
  unlink(outPath);

  SpiceInt handle = 0;
  dskopn_c(outPath, "TSPICE", 0, &handle);
  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    unlink(outPath);
    write_error_json("SPICE error in dskopn", shortMsg, longMsg, traceMsg);
    return false;
  }

  if ((size_t)DSK_MINIMAL_WORKSZ > SIZE_MAX / sizeof(SpiceInt[2])) {
    dascls_c(handle);
    unlink(outPath);
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceInt(*work)[2] = (SpiceInt(*)[2])malloc(sizeof(SpiceInt[2]) *
                                              (size_t)DSK_MINIMAL_WORKSZ);
  if (work == NULL) {
    dascls_c(handle);
    unlink(outPath);
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceDouble spaixd[SPICE_DSK02_IXDFIX];
  SpiceInt spaixi[DSK_MINIMAL_SPXISZ];

  dskmi2_c((SpiceInt)DSK_MINIMAL_NV,
           (SpiceDouble(*)[3])DSK_MINIMAL_VERTICES,
           (SpiceInt)DSK_MINIMAL_NP,
           (SpiceInt(*)[3])DSK_MINIMAL_PLATES,
           0.2,
           5,
           (SpiceInt)DSK_MINIMAL_WORKSZ,
           (SpiceInt)DSK_MINIMAL_VOXPSZ,
           (SpiceInt)DSK_MINIMAL_VOXLSZ,
           SPICETRUE,
           (SpiceInt)DSK_MINIMAL_SPXISZ,
           work,
           spaixd,
           spaixi);

  free(work);

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    dascls_c(handle);
    unlink(outPath);
    write_error_json("SPICE error in dskmi2", shortMsg, longMsg, traceMsg);
    return false;
  }

  dskw02_c((SpiceInt)handle,
           399,
           1,
           2,
           "J2000",
           3,
           DSK_MINIMAL_CORPAR,
           0,
           1,
           0,
           1,
           -0.1,
           0.1,
           0,
           1,
           (SpiceInt)DSK_MINIMAL_NV,
           (SpiceDouble(*)[3])DSK_MINIMAL_VERTICES,
           (SpiceInt)DSK_MINIMAL_NP,
           (SpiceInt(*)[3])DSK_MINIMAL_PLATES,
           spaixd,
           spaixi);

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    dascls_c(handle);
    unlink(outPath);
    write_error_json("SPICE error in dskw02", shortMsg, longMsg, traceMsg);
    return false;
  }

  dascls_c(handle);
  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    unlink(outPath);
    write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
    return false;
  }

  return true;
}