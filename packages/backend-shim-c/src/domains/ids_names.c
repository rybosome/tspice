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

int tspice_bodc2s(
    int code,
    char *outName,
    int outNameMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outNameMaxBytes > 0 && outName) {
    outName[0] = '\0';
  }

  bodc2s_c((SpiceInt)code, (SpiceInt)outNameMaxBytes, outName);

  // Defensive: ensure the output buffer is always null-terminated.
  if (outName && outNameMaxBytes > 0) {
    outName[outNameMaxBytes - 1] = '\0';
  }

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_bods2c(
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
  bods2c_c(name, &codeC, &foundC);
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

int tspice_boddef(
    const char *name,
    int code,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  boddef_c(name, (SpiceInt)code);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_bodfnd(
    int body,
    const char *item,
    int *outResult,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outResult) {
    *outResult = 0;
  }

  SpiceBoolean foundC = bodfnd_c((SpiceInt)body, item);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outResult) {
    *outResult = (foundC == SPICETRUE) ? 1 : 0;
  }

  return 0;
}

int tspice_bodvar(
    int body,
    const char *item,
    int maxn,
    int *outDim,
    double *outValues,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outDim) {
    *outDim = 0;
  }

  SpiceInt dimC = 0;
  bodvcd_c((SpiceInt)body, item, (SpiceInt)maxn, &dimC, outValues);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outDim) {
    *outDim = (int)dimC;
  }

  return 0;
}
