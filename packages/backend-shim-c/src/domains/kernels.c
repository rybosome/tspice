#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <string.h>

int tspice_furnsh(const char *path, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  furnsh_c(path);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_unload(const char *path, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  unload_c(path);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_kclear(char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  kclear_c();
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_ktotal(const char *kind, int *outCount, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCount) {
    *outCount = 0;
  }

  SpiceInt count = 0;
  ktotal_c(kind, &count);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outCount) {
    *outCount = (int)count;
  }

  return 0;
}

int tspice_kdata(
    int which,
    const char *kind,
    char *file,
    int fileMaxBytes,
    char *filtyp,
    int filtypMaxBytes,
    char *source,
    int sourceMaxBytes,
    int *outHandle,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (fileMaxBytes > 0 && file) {
    file[0] = '\0';
  }
  if (filtypMaxBytes > 0 && filtyp) {
    filtyp[0] = '\0';
  }
  if (sourceMaxBytes > 0 && source) {
    source[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt handleC = 0;
  SpiceBoolean foundC = SPICEFALSE;

  kdata_c(
      (SpiceInt)which,
      kind,
      (SpiceInt)fileMaxBytes,
      (SpiceInt)filtypMaxBytes,
      (SpiceInt)sourceMaxBytes,
      file,
      filtyp,
      source,
      &handleC,
      &foundC);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outHandle) {
    *outHandle = (int)handleC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_ktotal_all(char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt count = 0;
  ktotal_c("ALL", &count);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return -1;
  }

  return (int)count;
}
