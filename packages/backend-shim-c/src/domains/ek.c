#include "tspice_backend_shim.h"

#include "SpiceUsr.h"
#include "SpiceEK.h"

#include <stddef.h>
#include <string.h>

// --- ABI guard ---------------------------------------------------------
//
// tspice assumes `SpiceInt` is 32-bit across native + WASM builds.
// Refuse to build if the CSPICE toolkit was compiled with a different size
// to avoid silent truncation across boundaries.
#if defined(__STDC_VERSION__) && __STDC_VERSION__ >= 201112L
_Static_assert(sizeof(SpiceInt) == 4, "tspice_backend_shim requires sizeof(SpiceInt)==4");
#else
typedef char tspice_spiceint_must_be_32bit[(sizeof(SpiceInt) == 4) ? 1 : -1];
#endif


static int tspice_ek_invalid_arg(char *err, int errMaxBytes, const char *msg) {
  // Clear any previous structured SPICE error fields so higher-level callers
  // don't attach stale `spiceShort` / `spiceLong` / `spiceTrace` fields to
  // these non-CSPICE validation errors.
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


int tspice_ekopr(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopr: path must be a non-empty string");
  }
  if (!outHandle) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopr: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  ekopr_c(path, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outHandle = (int)handleC;
  return 0;
}

int tspice_ekopw(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopw: path must be a non-empty string");
  }
  if (!outHandle) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopw: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  ekopw_c(path, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outHandle = (int)handleC;
  return 0;
}

int tspice_ekopn(
    const char *path,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopn: path must be a non-empty string");
  }
  if (!ifname || ifname[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopn: ifname must be a non-empty string");
  }
  if (ncomch < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopn: ncomch must be >= 0");
  }
  if (!outHandle) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekopn: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  ekopn_c(path, ifname, (SpiceInt)ncomch, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outHandle = (int)handleC;
  return 0;
}

int tspice_ekcls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (handle <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekcls: handle must be > 0");
  }

  ekcls_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  return 0;
}

int tspice_ekntab(int *outN, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outN) {
    *outN = 0;
  }

  if (!outN) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekntab: outN must be non-NULL");
  }

  SpiceInt nC = 0;
  ekntab_c(&nC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (nC < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekntab: expected a non-negative table count");
  }

  *outN = (int)nC;
  return 0;
}

int tspice_ektnam(int n, char *outName, int outNameMaxBytes, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outName && outNameMaxBytes > 0) {
    outName[0] = '\0';
  }

  if (!outName) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ektnam: outName must be non-NULL");
  }
  if (outNameMaxBytes < 2) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ektnam: outNameMaxBytes must be >= 2");
  }
  if (n < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ektnam: n must be >= 0");
  }

  ektnam_c((SpiceInt)n, (SpiceInt)outNameMaxBytes, outName);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  // Ensure stable NUL-termination even if code changes.
  outName[outNameMaxBytes - 1] = '\0';
  return 0;
}

int tspice_eknseg(int handle, int *outNseg, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outNseg) {
    *outNseg = 0;
  }

  if (!outNseg) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_eknseg: outNseg must be non-NULL");
  }
  if (handle <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_eknseg: handle must be > 0");
  }

  const SpiceInt nsegC = eknseg_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outNseg = (int)nsegC;
  return 0;
}
