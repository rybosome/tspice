#include "tspice_backend_shim.h"
#include "tspice_error.h"

#include "SpiceUsr.h"

#include <string.h>

int tspice_spkezr(
    const char *target,
    double et,
    const char *ref,
    const char *abcorr,
    const char *observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble state[6];
  SpiceDouble lt = 0.0;
  spkezr_c(target, (SpiceDouble)et, ref, abcorr, observer, state, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outState6) {
    outState6[0] = (double)state[0];
    outState6[1] = (double)state[1];
    outState6[2] = (double)state[2];
    outState6[3] = (double)state[3];
    outState6[4] = (double)state[4];
    outState6[5] = (double)state[5];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}

int tspice_spkpos(
    const char *target,
    double et,
    const char *ref,
    const char *abcorr,
    const char *observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble pos[3];
  SpiceDouble lt = 0.0;
  spkpos_c(target, (SpiceDouble)et, ref, abcorr, observer, pos, &lt);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outPos3) {
    outPos3[0] = (double)pos[0];
    outPos3[1] = (double)pos[1];
    outPos3[2] = (double)pos[2];
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}


int tspice_spkopn(
    const char *path,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) err[0] = '\0';
  if (outHandle) *outHandle = 0;

  if (!path || path[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_spkopn: path must be a non-empty string");
  }
  if (!ifname || ifname[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_spkopn: ifname must be a non-empty string");
  }
  if (ncomch < 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_spkopn: ncomch must be >= 0");
  }
  if (!outHandle) {
    return tspice_return_error(err, errMaxBytes, "tspice_spkopn: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  spkopn_c(path, ifname, (SpiceInt)ncomch, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outHandle = (int)handleC;
  return 0;
}

int tspice_spkopa(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) err[0] = '\0';
  if (outHandle) *outHandle = 0;

  if (!path || path[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_spkopa: path must be a non-empty string");
  }
  if (!outHandle) {
    return tspice_return_error(err, errMaxBytes, "tspice_spkopa: outHandle must be non-NULL");
  }

  SpiceInt handleC = 0;
  spkopa_c(path, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outHandle = (int)handleC;
  return 0;
}

int tspice_spkcls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) err[0] = '\0';

  spkcls_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_spkw08(
    int handle,
    int body,
    int center,
    const char *frame,
    double first,
    double last,
    const char *segid,
    int degree,
    int n,
    const double *states6n,
    double epoch1,
    double step,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) err[0] = '\0';

  if (!frame || frame[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_spkw08: frame must be a non-empty string");
  }
  if (!segid || segid[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_spkw08: segid must be a non-empty string");
  }
  if (n <= 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_spkw08: n must be > 0");
  }
  if (!states6n) {
    return tspice_return_error(err, errMaxBytes, "tspice_spkw08: states6n must be non-NULL");
  }

  // Interpret `states6n` as an array of `n` 6-vectors.
  const SpiceDouble(*states)[6] = (const SpiceDouble(*)[6])states6n;

  spkw08_c(
      (SpiceInt)handle,
      (SpiceInt)body,
      (SpiceInt)center,
      frame,
      (SpiceDouble)first,
      (SpiceDouble)last,
      segid,
      (SpiceInt)degree,
      (SpiceInt)n,
      states,
      (SpiceDouble)epoch1,
      (SpiceDouble)step);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_spkw08_v2(
    int handle,
    int body,
    int center,
    const char *frame,
    double first,
    double last,
    const char *segid,
    int degree,
    int n,
    const double *states6n,
    int states6nLen,
    double epoch1,
    double step,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) err[0] = '\0';

  if (!frame || frame[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_spkw08_v2: frame must be a non-empty string");
  }
  if (!segid || segid[0] == '\0') {
    return tspice_return_error(err, errMaxBytes, "tspice_spkw08_v2: segid must be a non-empty string");
  }
  if (n <= 0) {
    return tspice_return_error(err, errMaxBytes, "tspice_spkw08_v2: n must be > 0");
  }
  if (!states6n) {
    return tspice_return_error(err, errMaxBytes, "tspice_spkw08_v2: states6n must be non-NULL");
  }

  // Validate the flat input length before casting to `SpiceDouble[n][6]`.
  const int64_t expectedStates6nLen = (int64_t)n * 6;
  if ((int64_t)states6nLen != expectedStates6nLen) {
    return tspice_return_error(err, errMaxBytes, "tspice_spkw08_v2: states6nLen must equal 6*n");
  }

  // Interpret `states6n` as an array of `n` 6-vectors.
  const SpiceDouble(*states)[6] = (const SpiceDouble(*)[6])states6n;

  spkw08_c(
      (SpiceInt)handle,
      (SpiceInt)body,
      (SpiceInt)center,
      frame,
      (SpiceDouble)first,
      (SpiceDouble)last,
      segid,
      (SpiceInt)degree,
      (SpiceInt)n,
      states,
      (SpiceDouble)epoch1,
      (SpiceDouble)step);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}
