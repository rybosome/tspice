#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <stdio.h>

#define TSPICE_BODY_POOLVAR_MAX_BYTES 33

static int tspice_ids_names_invalid_arg(char *err, int errMaxBytes, const char *msg) {
  // This module provides a stable C ABI surface.
  //
  // If callers pass invalid pointers/lengths, we must not invoke CSPICE with
  // arguments that could cause undefined behavior.
  //
  // Also, clear any previous structured SPICE error fields so higher-level
  // callers (e.g. the Node addon) don't accidentally attach stale `spiceShort`
  // / `spiceLong` / `spiceTrace` fields to these non-CSPICE validation errors.
  //
  // NOTE: Avoid resetting CSPICE error status here. Invalid-arg errors are not
  // CSPICE failures and should not wipe unrelated global SPICE error state.
  tspice_clear_last_error_buffers();

  if (err && errMaxBytes > 0) {
    if (msg) {
      strncpy(err, msg, (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    } else {
      err[0] = '\0';
    }
  }

  return 1;
}

static int tspice_format_body_pool_var(
    int body,
    const char *item,
    char *outPoolVar,
    size_t outPoolVarMaxBytes,
    const char *context,
    char *err,
    int errMaxBytes) {
  const int written = snprintf(outPoolVar, outPoolVarMaxBytes, "BODY%d_%s", body, item);
  // NAIF BODFND/BODVAR construct a 32-byte pool key. Truncation is part
  // of that lookup, including a long item whose prefix names a valid variable.
  if (written < 0) {
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

// In N0067 the surface-ID hash takes abs(SpiceInt). INT32_MIN has no
// representable absolute value. This guard also covers codes supplied by an
// already-loaded kernel; looking only at the direct arguments is insufficient.
// Read the numeric pool (not the hash) while the same CSPICE call is serialized.
static int surface_pool_hashable(char *err, int errMaxBytes) {
  SpiceBoolean found = SPICEFALSE;
  SpiceInt count = 0;
  SpiceChar type[2] = {0};
  dtpool_c("NAIF_SURFACE_CODE", &found, &count, type);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  // Absent, nonnumeric and oversized tables take canonical validation paths;
  // ZZSRFKER diagnoses a size > 2000 before fetching or hashing its codes.
  if (!found || type[0] != 'N' || count > 2000) return 0;
  for (SpiceInt start = 0; start < count; start += 64) {
    SpiceDouble values[64];
    SpiceInt used = 0;
    gdpool_c("NAIF_SURFACE_CODE", start, 64, &used, values, &found);
    if (failed_c()) {
      tspice_get_spice_error_message_and_reset(err, errMaxBytes);
      return 1;
    }
    for (SpiceInt i = 0; i < used; ++i) {
      // GIPOOL checks signed range then uses nearest-integer, ties away
      // from zero. Smaller out-of-domain values already signal a CSPICE error.
      if (values[i] >= (SpiceDouble)INT32_MIN && values[i] <= (SpiceDouble)INT32_MIN + 0.5)
        return tspice_ids_names_invalid_arg(err, errMaxBytes, "NAIF_SURFACE_CODE contains an ID outside the safe N0067 surface hash range");
    }
  }
  return 0;
}

int tspice_srfc2s(int code, int bodyId, int srflen, char *outText, int *outIsName, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!outText || !outIsName) return tspice_ids_names_invalid_arg(err, errMaxBytes, "Missing srfc2s argument");
  if (code == INT32_MIN) return tspice_ids_names_invalid_arg(err, errMaxBytes, "Surface ID outside safe N0067 surface hash range");
  if (surface_pool_hashable(err, errMaxBytes)) return 1;
  SpiceBoolean flag = SPICEFALSE;
  srfc2s_c(code, bodyId, srflen, outText, &flag);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *outIsName = (flag == SPICETRUE);
  return 0;
}

int tspice_srfcss(int code, const char *body, int srflen, char *outText, int *outIsName, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!body || !outText || !outIsName) return tspice_ids_names_invalid_arg(err, errMaxBytes, "Missing srfcss argument");
  if (code == INT32_MIN) return tspice_ids_names_invalid_arg(err, errMaxBytes, "Surface ID outside safe N0067 surface hash range");
  if (surface_pool_hashable(err, errMaxBytes)) return 1;
  SpiceBoolean flag = SPICEFALSE;
  srfcss_c(code, body, srflen, outText, &flag);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *outIsName = (flag == SPICETRUE);
  return 0;
}

int tspice_srfs2c(const char *surface, const char *body, int *outCode, int *outFound, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!surface || !body || !outCode || !outFound) return tspice_ids_names_invalid_arg(err, errMaxBytes, "Missing srfs2c argument");
  if (surface_pool_hashable(err, errMaxBytes)) return 1;
  SpiceBoolean flag = SPICEFALSE;
  SpiceInt code = 0;
  srfs2c_c(surface, body, &code, &flag);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *outFound = (flag == SPICETRUE);
  if (*outFound) *outCode = code;
  return 0;
}

int tspice_srfscc(const char *surface, int bodyId, int *outCode, int *outFound, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!surface || !outCode || !outFound) return tspice_ids_names_invalid_arg(err, errMaxBytes, "Missing srfscc argument");
  if (surface_pool_hashable(err, errMaxBytes)) return 1;
  SpiceBoolean flag = SPICEFALSE;
  SpiceInt code = 0;
  srfscc_c(surface, bodyId, &code, &flag);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  *outFound = (flag == SPICETRUE);
  if (*outFound) *outCode = code;
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

  if (outNameMaxBytes > 0 && !outName) {
    return tspice_ids_names_invalid_arg(
        err,
        errMaxBytes,
        "tspice_bodc2n(): outName must not be NULL when outNameMaxBytes > 0");
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

  if (outNameMaxBytes > 0 && !outName) {
    return tspice_ids_names_invalid_arg(
        err,
        errMaxBytes,
        "tspice_bodc2s(): outName must not be NULL when outNameMaxBytes > 0");
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

  const SpiceBoolean foundC = bodfnd_c((SpiceInt)body, item);

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

  // Caller requested zero values; don't invoke CSPICE with a zero-length output.
  // NOTE: We still run the `dtpool_c()` preflight above for validation.
  if (maxn == 0) {
    // Query mode lets adapters allocate exactly the validated numeric dimension.
    if (outDim) *outDim = (int)nC;
    return 0;
  }

  SpiceInt maxnC = (SpiceInt)maxn;
  if (maxnC > nC) {
    maxnC = nC;
  }

  SpiceInt dimC = 0;
  bodvcd_c((SpiceInt)body, item, maxnC, &dimC, outValues);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (dimC < 0) {
    dimC = 0;
  }
  if (dimC > nC) {
    dimC = nC;
  }
  if (dimC > maxn) {
    dimC = (SpiceInt)maxn;
  }

  if (outDim) {
    *outDim = (int)dimC;
  }

  return 0;
}
