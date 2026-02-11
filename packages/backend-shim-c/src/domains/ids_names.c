#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <string.h>
#include <stdio.h>

#define TSPICE_BODY_POOLVAR_MAX_BYTES 1024

static int tspice_format_body_pool_var(
    int body,
    const char *item,
    char *outPoolVar,
    size_t outPoolVarMaxBytes,
    const char *context,
    char *err,
    int errMaxBytes) {
  const int written = snprintf(outPoolVar, outPoolVarMaxBytes, "BODY%d_%s", body, item);
  if (written < 0 || (size_t)written >= outPoolVarMaxBytes) {
    // This is a shim-level validation failure (not a CSPICE error).
    // Avoid calling `reset_c()` here; error translation layers should decide
    // whether to attach structured SPICE fields.
    if (err && errMaxBytes > 0) {
      const char *label = context ? context : "bodvar";
      snprintf(err, (size_t)errMaxBytes, "%s: item too long", label);
      err[errMaxBytes - 1] = '\0';
    }

    return 1;
  }

  return 0;
}

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
  char poolVar[TSPICE_BODY_POOLVAR_MAX_BYTES];
  if (tspice_format_body_pool_var(body, item, poolVar, sizeof(poolVar), "bodfnd", err, errMaxBytes) != 0) {
    return 1;
  }

  SpiceBoolean foundC = SPICEFALSE;
  SpiceInt nC = 0;
  SpiceChar typeC = 0;
  dtpool_c(poolVar, &foundC, &nC, &typeC);

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

  if (maxn < 0) {
    if (err && errMaxBytes > 0) {
      snprintf(err, (size_t)errMaxBytes, "bodvar: maxn must be >= 0");
      err[errMaxBytes - 1] = '\0';
    }
    return 1;
  }

  if (maxn > 0 && !outValues) {
    if (err && errMaxBytes > 0) {
      snprintf(err, (size_t)errMaxBytes, "bodvar: outValues must not be NULL when maxn > 0");
      err[errMaxBytes - 1] = '\0';
    }
    return 1;
  }

  // Missing / non-numeric body constants are a normal miss (dim=0) rather than
  // a SPICE error.
  //
  // IMPORTANT: `bodfnd_c()` returns true even when the pool var is character-typed,
  // but `bodvcd_c()` errors on non-numeric pool vars. To avoid throwing, we
  // preflight with `dtpool_c()` on the canonical pool name `BODY<body>_<ITEM>`.
  char poolVar[TSPICE_BODY_POOLVAR_MAX_BYTES];
  if (tspice_format_body_pool_var(body, item, poolVar, sizeof(poolVar), "bodvar", err, errMaxBytes) != 0) {
    return 1;
  }

  // Caller requested zero values; don't invoke CSPICE with a zero-length output.
  if (maxn == 0) {
    return 0;
  }

  SpiceBoolean foundC = SPICEFALSE;
  SpiceInt nC = 0;
  SpiceChar typeC = 0;
  dtpool_c(poolVar, &foundC, &nC, &typeC);

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
