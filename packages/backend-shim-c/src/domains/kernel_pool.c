#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <stddef.h>
#include <string.h>

static int tspice_kernel_pool_invalid_arg(char *err, int errMaxBytes, const char *msg) {
  // This module provides a stable C ABI surface.
  //
  // If callers pass invalid pointers/lengths, we must not invoke CSPICE with
  // arguments that could cause undefined behavior.
  //
  // Also, clear any previous structured SPICE error fields so higher-level
  // callers (e.g. the Node addon) don't accidentally attach stale `spiceShort`
  // / `spiceLong` / `spiceTrace` fields to these non-CSPICE validation errors.
  tspice_reset(NULL, 0);

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

int tspice_gdpool(
    const char *name,
    int start,
    int room,
    int *outN,
    double *outValues,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outN) {
    *outN = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gdpool(): name must not be NULL");
  }
  if (start < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gdpool(): start must be >= 0");
  }
  if (room <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gdpool(): room must be > 0");
  }
  if (room > 0 && !outValues) {
    return tspice_kernel_pool_invalid_arg(
        err,
        errMaxBytes,
        "tspice_gdpool(): outValues must not be NULL when room > 0");
  }

  SpiceInt nC = 0;
  SpiceBoolean foundC = SPICEFALSE;

  gdpool_c(name, (SpiceInt)start, (SpiceInt)room, &nC, (SpiceDouble *)outValues, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outN) {
    *outN = (int)nC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_gipool(
    const char *name,
    int start,
    int room,
    int *outN,
    int *outValues,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outN) {
    *outN = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gipool(): name must not be NULL");
  }
  if (start < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gipool(): start must be >= 0");
  }
  if (room <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gipool(): room must be > 0");
  }
  if (room > 0 && !outValues) {
    return tspice_kernel_pool_invalid_arg(
        err,
        errMaxBytes,
        "tspice_gipool(): outValues must not be NULL when room > 0");
  }

  SpiceInt nC = 0;
  SpiceBoolean foundC = SPICEFALSE;

  gipool_c(name, (SpiceInt)start, (SpiceInt)room, &nC, (SpiceInt *)outValues, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outN) {
    *outN = (int)nC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_gcpool(
    const char *name,
    int start,
    int room,
    int cvalen,
    int *outN,
    void *outCvals,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outN) {
    *outN = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gcpool(): name must not be NULL");
  }
  if (start < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gcpool(): start must be >= 0");
  }
  if (room <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gcpool(): room must be > 0");
  }
  if (cvalen <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gcpool(): cvalen must be > 0");
  }
  if (room > 0 && !outCvals) {
    return tspice_kernel_pool_invalid_arg(
        err,
        errMaxBytes,
        "tspice_gcpool(): outCvals must not be NULL when room > 0");
  }

  SpiceInt nC = 0;
  SpiceBoolean foundC = SPICEFALSE;

  gcpool_c(
      name,
      (SpiceInt)start,
      (SpiceInt)room,
      (SpiceInt)cvalen,
      &nC,
      outCvals,
      &foundC);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outN) {
    *outN = (int)nC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_gnpool(
    const char *name,
    int start,
    int room,
    int cvalen,
    int *outN,
    void *outCvals,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outN) {
    *outN = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gnpool(): name must not be NULL");
  }
  if (start < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gnpool(): start must be >= 0");
  }
  if (room <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gnpool(): room must be > 0");
  }
  if (cvalen <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gnpool(): cvalen must be > 0");
  }
  if (room > 0 && !outCvals) {
    return tspice_kernel_pool_invalid_arg(
        err,
        errMaxBytes,
        "tspice_gnpool(): outCvals must not be NULL when room > 0");
  }

  SpiceInt nC = 0;
  SpiceBoolean foundC = SPICEFALSE;

  gnpool_c(
      name,
      (SpiceInt)start,
      (SpiceInt)room,
      (SpiceInt)cvalen,
      &nC,
      outCvals,
      &foundC);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outN) {
    *outN = (int)nC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_dtpool(
    const char *name,
    int *outFound,
    int *outN,
    char *outType,
    int outTypeMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }
  if (outN) {
    *outN = 0;
  }
  if (outType && outTypeMaxBytes > 0) {
    outType[0] = 'X';
    if (outTypeMaxBytes > 1) {
      outType[1] = '\0';
    }
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_dtpool(): name must not be NULL");
  }

  SpiceBoolean foundC = SPICEFALSE;
  SpiceInt nC = 0;
  SpiceChar typeC[2];
  typeC[0] = 'X';
  typeC[1] = '\0';

  dtpool_c(name, &foundC, &nC, typeC);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }
  if (outN) {
    *outN = (int)nC;
  }

  if (outType && outTypeMaxBytes > 0) {
    outType[0] = typeC[0];
    if (outTypeMaxBytes > 1) {
      outType[1] = '\0';
    }
  }

  return 0;
}

int tspice_pdpool(
    const char *name,
    int n,
    const double *values,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pdpool(): name must not be NULL");
  }
  if (n < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pdpool(): n must be >= 0");
  }
  if (n > 0 && !values) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pdpool(): values must not be NULL when n > 0");
  }

  pdpool_c(name, (SpiceInt)n, (ConstSpiceDouble *)values);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_pipool(
    const char *name,
    int n,
    const int *ivals,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pipool(): name must not be NULL");
  }
  if (n < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pipool(): n must be >= 0");
  }
  if (n > 0 && !ivals) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pipool(): ivals must not be NULL when n > 0");
  }

  pipool_c(name, (SpiceInt)n, (ConstSpiceInt *)ivals);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_pcpool(
    const char *name,
    int n,
    int lenvals,
    const void *cvals,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pcpool(): name must not be NULL");
  }
  if (n < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pcpool(): n must be >= 0");
  }
  if (lenvals <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pcpool(): lenvals must be > 0");
  }
  if (n > 0 && !cvals) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pcpool(): cvals must not be NULL when n > 0");
  }

  pcpool_c(name, (SpiceInt)n, (SpiceInt)lenvals, cvals);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_swpool(
    const char *agent,
    int nnames,
    int namlen,
    const void *names,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }

  if (!agent) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_swpool(): agent must not be NULL");
  }
  if (nnames < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_swpool(): nnames must be >= 0");
  }
  if (namlen <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_swpool(): namlen must be > 0");
  }
  if (nnames > 0 && !names) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_swpool(): names must not be NULL when nnames > 0");
  }

  swpool_c(agent, (SpiceInt)nnames, (SpiceInt)namlen, names);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_cvpool(
    const char *agent,
    int *outUpdate,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outUpdate) {
    *outUpdate = 0;
  }

  if (!agent) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_cvpool(): agent must not be NULL");
  }

  SpiceBoolean updateC = SPICEFALSE;
  cvpool_c(agent, &updateC);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outUpdate) {
    *outUpdate = updateC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_expool(
    const char *name,
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

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_expool(): name must not be NULL");
  }

  SpiceBoolean foundC = SPICEFALSE;
  expool_c(name, &foundC);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}
