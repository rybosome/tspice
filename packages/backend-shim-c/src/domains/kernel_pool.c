#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <string.h>

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
