#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <string.h>

int tspice_bodn2c(
    const char *name,
    int *outCode,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCode) {
    *outCode = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt codeC = 0;
  SpiceBoolean foundC = SPICEFALSE;
  bodn2c_c(name, &codeC, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outCode) {
    *outCode = (int)codeC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_bodc2n(
    int code,
    char *outName,
    int outNameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outNameMaxBytes > 0 && outName) {
    outName[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceBoolean foundC = SPICEFALSE;
  bodc2n_c((SpiceInt)code, (SpiceInt)outNameMaxBytes, outName, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}
