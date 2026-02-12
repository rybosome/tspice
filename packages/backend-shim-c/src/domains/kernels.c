#include "tspice_backend_shim.h"
#include "tspice_error.h"

#include "SpiceUsr.h"

#include <string.h>
#include <stdio.h>


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

int tspice_kinfo(
    const char *path,
    char *filtyp,
    int filtypMaxBytes,
    char *source,
    int sourceMaxBytes,
    int *outHandle,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
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

  if (!path || path[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_kinfo(): path must be a non-empty string");
  }

  if (!filtyp || filtypMaxBytes <= 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_kinfo(): filtyp must be non-null with filtypMaxBytes > 0");
  }
  if (!source || sourceMaxBytes <= 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_kinfo(): source must be non-null with sourceMaxBytes > 0");
  }

  SpiceInt handleC = 0;
  SpiceBoolean foundC = SPICEFALSE;

  kinfo_c(
      path,
      (SpiceInt)filtypMaxBytes,
      (SpiceInt)sourceMaxBytes,
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

int tspice_kxtrct(
    const char *keywd,
    int termlen,
    const char *terms,
    int nterms,
    const char *wordsqIn,
    char *wordsqOut,
    int wordsqOutMaxBytes,
    char *substr,
    int substrMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }
  if (wordsqOut && wordsqOutMaxBytes > 0) {
    wordsqOut[0] = '\0';
  }
  if (substr && substrMaxBytes > 0) {
    substr[0] = '\0';
  }

  if (!keywd || keywd[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_kxtrct(): keywd must be a non-empty string");
  }
  if (!wordsqIn) {
    return tspice_return_error(err, errMaxBytes, "tspice_kxtrct(): wordsqIn must be non-null");
  }
  if (!wordsqOut || wordsqOutMaxBytes <= 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_kxtrct(): wordsqOut must be non-null with wordsqOutMaxBytes > 0");
  }
  if (!substr || substrMaxBytes <= 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_kxtrct(): substr must be non-null with substrMaxBytes > 0");
  }
  if ((nterms > 0 && !terms) || termlen < 0 || nterms < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_kxtrct(): invalid terms/termlen/nterms");
  }

  // `kxtrct_c` mutates the wordsq buffer in-place. We copy the input into the
  // output buffer, but must fail fast if doing so would truncate the input
  // (including the trailing NUL).
  const size_t wordsqInLen = strlen(wordsqIn);
  if (wordsqInLen + 1 > (size_t)wordsqOutMaxBytes) {
    return tspice_return_error(err, errMaxBytes, "tspice_kxtrct(): wordsqIn would truncate wordsqOut");
  }

  // Copy input wordsq into the output buffer so `kxtrct_c` can mutate it in place.
  strncpy(wordsqOut, wordsqIn, (size_t)wordsqOutMaxBytes - 1);
  wordsqOut[wordsqOutMaxBytes - 1] = '\0';

  SpiceBoolean foundC = SPICEFALSE;
  kxtrct_c(
      keywd,
      (SpiceInt)termlen,
      (const void *)terms,
      (SpiceInt)nterms,
      (SpiceInt)wordsqOutMaxBytes,
      (SpiceInt)substrMaxBytes,
      wordsqOut,
      &foundC,
      substr);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
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
