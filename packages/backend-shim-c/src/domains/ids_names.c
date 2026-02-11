#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <string.h>
#include <stdio.h>
#include <stdlib.h>

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

  // `bodfnd_c()` returns true even when the pool var exists but is character-typed.
  // Our backend contract treats non-numeric BODY<ID>_<ITEM> vars as a normal miss,
  // so preflight with `dtpool_c()` on the canonical pool name.
  const size_t poolVarMaxBytes = strlen(item) + 32;
  char *poolVar = (char *)malloc(poolVarMaxBytes);
  if (!poolVar) {
    tspice_reset(NULL, 0);

    if (err && errMaxBytes > 0) {
      strncpy(err, "malloc failed while formatting BODY<ID>_<ITEM>", (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }

    return 1;
  }

  snprintf(poolVar, poolVarMaxBytes, "BODY%d_%s", body, item);

  SpiceBoolean foundC = SPICEFALSE;
  SpiceInt nC = 0;
  SpiceChar typeC = 0;
  dtpool_c(poolVar, &foundC, &nC, &typeC);
  free(poolVar);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outResult) {
    *outResult = (foundC == SPICETRUE && typeC == 'N') ? 1 : 0;
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

  // Missing / non-numeric body constants are a normal miss (dim=0) rather than
  // a SPICE error.
  //
  // IMPORTANT: `bodfnd_c()` returns true even when the pool var is character-typed,
  // but `bodvcd_c()` errors on non-numeric pool vars. To avoid throwing, we
  // preflight with `dtpool_c()` on the canonical pool name `BODY<body>_<ITEM>`.
  const size_t poolVarMaxBytes = strlen(item) + 32;
  char *poolVar = (char *)malloc(poolVarMaxBytes);
  if (!poolVar) {
    tspice_reset(NULL, 0);

    if (err && errMaxBytes > 0) {
      strncpy(err, "malloc failed while formatting BODY<ID>_<ITEM>", (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }

    return 1;
  }

  snprintf(poolVar, poolVarMaxBytes, "BODY%d_%s", body, item);

  SpiceBoolean foundC = SPICEFALSE;
  SpiceInt nC = 0;
  SpiceChar typeC = 0;
  dtpool_c(poolVar, &foundC, &nC, &typeC);
  free(poolVar);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (foundC != SPICETRUE || typeC != 'N' || nC <= 0) {
    return 0;
  }

  SpiceInt dimC = 0;
  bodvcd_c((SpiceInt)body, item, (SpiceInt)maxn, &dimC, outValues);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (dimC < 0) {
    dimC = 0;
  }
  if (dimC > maxn) {
    dimC = (SpiceInt)maxn;
  }

  if (outDim) {
    *outDim = (int)dimC;
  }

  return 0;
}
