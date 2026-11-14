#include <math.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "../handle_validation.h"
#include "SpiceUsr.h"
#include "tspice_backend_shim.h"

static int tspice_ephemeris_invalid_arg(char *err, int errMaxBytes, const char *msg) {
  // Stable ABI boundary: never invoke CSPICE with invalid pointers/lengths.
  // Also clear structured last-error buffers so higher-level callers don't
  // accidentally attach stale SPICE fields to these validation errors.
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

static int tspice_int_to_spice_int_checked(
    int value,
    SpiceInt *out,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  if (!out) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_int_to_spice_int_checked(): out must be non-null");
  }

  const SpiceInt v = (SpiceInt)value;
  if ((int)v != value) {
    char buf[200];
    snprintf(buf, sizeof(buf), "%s: int value out of SpiceInt range (%d)", ctx, value);
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, buf);
  }

  *out = v;
  return 0;
}

static int tspice_spice_int_to_int_checked(
    SpiceInt value,
    int *out,
    const char *ctx,
    char *err,
    int errMaxBytes) {
  if (!out) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spice_int_to_int_checked(): out must be non-null");
  }

  const int v = (int)value;
  if ((SpiceInt)v != value) {
    char buf[220];
    snprintf(buf, sizeof(buf), "%s: SpiceInt value out of int range (%ld)", ctx, (long)value);
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, buf);
  }

  *out = v;
  return 0;
}

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

int tspice_spkez(
    int target,
    double et,
    const char *ref,
    const char *abcorr,
    int observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkez()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkez()", err, errMaxBytes) != 0) return 1;

  SpiceDouble state[6];
  SpiceDouble lt = 0.0;
  spkez_c(targ, (SpiceDouble)et, ref, abcorr, obs, state, &lt);
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

int tspice_spkezp(
    int target,
    double et,
    const char *ref,
    const char *abcorr,
    int observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkezp()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkezp()", err, errMaxBytes) != 0) return 1;

  SpiceDouble pos[3];
  SpiceDouble lt = 0.0;
  spkezp_c(targ, (SpiceDouble)et, ref, abcorr, obs, pos, &lt);
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

int tspice_spkgeo(
    int target,
    double et,
    const char *ref,
    int observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkgeo()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkgeo()", err, errMaxBytes) != 0) return 1;

  SpiceDouble state[6];
  SpiceDouble lt = 0.0;
  spkgeo_c(targ, (SpiceDouble)et, ref, obs, state, &lt);
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

int tspice_spkgps(
    int target,
    double et,
    const char *ref,
    int observer,
    double *outPos3,
    double *outLt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  SpiceInt obs = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkgps()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(observer, &obs, "tspice_spkgps()", err, errMaxBytes) != 0) return 1;

  SpiceDouble pos[3];
  SpiceDouble lt = 0.0;
  spkgps_c(targ, (SpiceDouble)et, ref, obs, pos, &lt);
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

int tspice_spkssb(
    int target,
    double et,
    const char *ref,
    double *outState6,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt targ = 0;
  if (tspice_int_to_spice_int_checked(target, &targ, "tspice_spkssb()", err, errMaxBytes) != 0) return 1;

  SpiceDouble state[6];
  spkssb_c(targ, (SpiceDouble)et, ref, state);
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

  return 0;
}

int tspice_spkcov(
    const char *spk,
    int idcode,
    uintptr_t coverWindowHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *cover = tspice_validate_handle(coverWindowHandle, "window", "tspice_spkcov()", err, errMaxBytes);
  if (!cover) {
    return 1;
  }
  if (cover->dtype != SPICE_DP) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkcov(): expected SPICE_DP window");
  }

  SpiceInt code = 0;
  if (tspice_int_to_spice_int_checked(idcode, &code, "tspice_spkcov()", err, errMaxBytes) != 0) return 1;

  spkcov_c(spk, code, cover);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_spkobj(
    const char *spk,
    uintptr_t idsCellHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceCell *ids = tspice_validate_handle(idsCellHandle, "cell", "tspice_spkobj()", err, errMaxBytes);
  if (!ids) {
    return 1;
  }
  if (ids->dtype != SPICE_INT) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkobj(): expected SPICE_INT cell");
  }

  spkobj_c(spk, ids);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_spksfs(
    int body,
    double et,
    int *outHandle,
    double *outDescr5,
    char *outIdent,
    int outIdentMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }
  if (outHandle) {
    *outHandle = 0;
  }
  if (outIdentMaxBytes > 0 && outIdent) {
    outIdent[0] = '\0';
  }
  if (outDescr5) {
    for (int i = 0; i < 5; i++) {
      outDescr5[i] = 0.0;
    }
  }

  if (outIdentMaxBytes > 0 && !outIdent) {
    return tspice_ephemeris_invalid_arg(
        err,
        errMaxBytes,
        "tspice_spksfs(): outIdent must not be NULL when outIdentMaxBytes > 0");
  }

  // NAIF SIDLEN is 40 characters (excluding NUL).
  // Caller must provide SIDLEN+1 bytes.
  const int kMinIdentBytes = 41;
  if (outIdentMaxBytes < kMinIdentBytes) {
    return tspice_ephemeris_invalid_arg(
        err,
        errMaxBytes,
        "tspice_spksfs(): outIdentMaxBytes must be >= 41 (SIDLEN+1) to avoid truncation");
  }

  SpiceInt b = 0;
  if (tspice_int_to_spice_int_checked(body, &b, "tspice_spksfs()", err, errMaxBytes) != 0) return 1;

  SpiceInt handle = 0;
  SpiceDouble descr[5];
  SpiceBoolean found = SPICEFALSE;

  spksfs_c(b, (SpiceDouble)et, (SpiceInt)outIdentMaxBytes, &handle, descr, outIdent, &found);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = found ? 1 : 0;
  }

  if (!found) {
    return 0;
  }

  if (outHandle) {
    if (tspice_spice_int_to_int_checked(handle, outHandle, "tspice_spksfs()", err, errMaxBytes) != 0) {
      return 1;
    }
  }

  if (outDescr5) {
    outDescr5[0] = (double)descr[0];
    outDescr5[1] = (double)descr[1];
    outDescr5[2] = (double)descr[2];
    outDescr5[3] = (double)descr[3];
    outDescr5[4] = (double)descr[4];
  }

  // `outIdent` is already filled.
  return 0;
}

int tspice_spkpds(
    int body,
    int center,
    const char *frame,
    int type,
    double first,
    double last,
    double *outDescr5,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outDescr5) {
    for (int i = 0; i < 5; i++) {
      outDescr5[i] = 0.0;
    }
  }

  SpiceInt b = 0;
  SpiceInt c = 0;
  SpiceInt t = 0;
  if (tspice_int_to_spice_int_checked(body, &b, "tspice_spkpds()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(center, &c, "tspice_spkpds()", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(type, &t, "tspice_spkpds()", err, errMaxBytes) != 0) return 1;

  SpiceDouble descr[5];
  spkpds_c(b, c, frame, t, (SpiceDouble)first, (SpiceDouble)last, descr);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outDescr5) {
    outDescr5[0] = (double)descr[0];
    outDescr5[1] = (double)descr[1];
    outDescr5[2] = (double)descr[2];
    outDescr5[3] = (double)descr[3];
    outDescr5[4] = (double)descr[4];
  }

  return 0;
}

int tspice_spkuds(
    const double *descr5,
    int *outBody,
    int *outCenter,
    int *outFrame,
    int *outType,
    double *outFirst,
    double *outLast,
    int *outBaddr,
    int *outEaddr,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!descr5) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkuds(): descr5 must not be NULL");
  }

  SpiceInt body = 0;
  SpiceInt center = 0;
  SpiceInt frame = 0;
  SpiceInt type = 0;
  SpiceDouble first = 0.0;
  SpiceDouble last = 0.0;
  SpiceInt baddrs = 0;
  SpiceInt eaddrs = 0;

  spkuds_c((ConstSpiceDouble *)descr5, &body, &center, &frame, &type, &first, &last, &baddrs, &eaddrs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outBody) {
    if (tspice_spice_int_to_int_checked(body, outBody, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outCenter) {
    if (tspice_spice_int_to_int_checked(center, outCenter, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outFrame) {
    if (tspice_spice_int_to_int_checked(frame, outFrame, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outType) {
    if (tspice_spice_int_to_int_checked(type, outType, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outFirst) {
    *outFirst = (double)first;
  }
  if (outLast) {
    *outLast = (double)last;
  }
  if (outBaddr) {
    if (tspice_spice_int_to_int_checked(baddrs, outBaddr, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }
  if (outEaddr) {
    if (tspice_spice_int_to_int_checked(eaddrs, outEaddr, "tspice_spkuds()", err, errMaxBytes) != 0) return 1;
  }

  return 0;
}

// --- SPK writers ------------------------------------------------------------

int tspice_spkopn(
    const char *path,
    const char *ifname,
    int ncomch,
    int *outHandle,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopn(): path must be a non-empty string");
  }
  if (!ifname) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopn(): ifname must not be NULL");
  }
  if (!outHandle) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopn(): outHandle must not be NULL");
  }

  SpiceInt ncomchC = 0;
  if (tspice_int_to_spice_int_checked(ncomch, &ncomchC, "tspice_spkopn(ncomch)", err, errMaxBytes) != 0) return 1;

  SpiceInt handleC = 0;
  spkopn_c(path, ifname, ncomchC, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (tspice_spice_int_to_int_checked(handleC, outHandle, "tspice_spkopn(outHandle)", err, errMaxBytes) != 0) return 1;
  return 0;
}

int tspice_spkopa(const char *path, int *outHandle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outHandle) {
    *outHandle = 0;
  }

  if (!path || path[0] == '\0') {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopa(): path must be a non-empty string");
  }
  if (!outHandle) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkopa(): outHandle must not be NULL");
  }

  SpiceInt handleC = 0;
  spkopa_c(path, &handleC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (tspice_spice_int_to_int_checked(handleC, outHandle, "tspice_spkopa(outHandle)", err, errMaxBytes) != 0) return 1;
  return 0;
}

int tspice_spkcls(int handle, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt handleC = 0;
  if (tspice_int_to_spice_int_checked(handle, &handleC, "tspice_spkcls(handle)", err, errMaxBytes) != 0) return 1;

  spkcls_c(handleC);
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
  // v1 entrypoint: best-effort dispatch through v2 with an inferred flat length.
  const int64_t expectedStates6nLen = (int64_t)n * 6;
  if (expectedStates6nLen > 2147483647LL) {
    // Keep the ABI stable: validate before casting down to int.
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08(): inferred states6nLen would overflow int");
  }
  return tspice_spkw08_v2(
      handle,
      body,
      center,
      frame,
      first,
      last,
      segid,
      degree,
      n,
      states6n,
      (int)expectedStates6nLen,
      epoch1,
      step,
      err,
      errMaxBytes);
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

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!frame) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): frame must not be NULL");
  }
  if (!segid) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): segid must not be NULL");
  }
  if (n <= 0) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): n must be > 0");
  }
  if (!states6n) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): states6n must not be NULL");
  }

  // Validate the flat input length before casting to `SpiceDouble[n][6]`.
  const int64_t expectedStates6nLen = (int64_t)n * 6;
  if ((int64_t)states6nLen != expectedStates6nLen) {
    return tspice_ephemeris_invalid_arg(err, errMaxBytes, "tspice_spkw08_v2(): states6nLen must equal 6*n");
  }

  SpiceInt handleC = 0;
  SpiceInt bodyC = 0;
  SpiceInt centerC = 0;
  SpiceInt degreeC = 0;
  SpiceInt nC = 0;

  if (tspice_int_to_spice_int_checked(handle, &handleC, "tspice_spkw08_v2(handle)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(body, &bodyC, "tspice_spkw08_v2(body)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(center, &centerC, "tspice_spkw08_v2(center)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(degree, &degreeC, "tspice_spkw08_v2(degree)", err, errMaxBytes) != 0) return 1;
  if (tspice_int_to_spice_int_checked(n, &nC, "tspice_spkw08_v2(n)", err, errMaxBytes) != 0) return 1;

  // Interpret `states6n` as an array of `n` 6-vectors.
  const SpiceDouble(*states)[6] = (const SpiceDouble(*)[6])states6n;

  spkw08_c(
      handleC,
      bodyC,
      centerC,
      frame,
      (SpiceDouble)first,
      (SpiceDouble)last,
      segid,
      degreeC,
      nC,
      states,
      (SpiceDouble)epoch1,
      (SpiceDouble)step);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

// N0067 checks count and polynomial degree before reading coefficients.
// Invalid count/degree calls use an addressable sentinel for their SPICE errors.
static int check_chebyshev_buffer(int type, int n, int degree, const double* data, int words,
                                  const char* frame, const char* segid, char* err, int cap) {
  if (!data || !frame || !segid || words < 0 || words > 33554432)
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid Chebyshev input buffer");
  if (n > 0 && degree >= 0 && degree <= (type == 20 ? 50 : 27)) {
    int stride = (type == 3 ? 6 : 3) * (degree + (type == 20 ? 2 : 1));
    if ((int64_t)n * stride != words)
      return tspice_ephemeris_invalid_arg(
          err, cap, "Chebyshev coefficient length does not match record dimensions");
    for (int i = 0; i < words; ++i) {
      if (!isfinite(data[i]))
        return tspice_ephemeris_invalid_arg(err, cap, "Chebyshev coefficients must be finite");
    }
  }
  return 0;
}

int tspice_spkw02(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, double intlen, int n, int degree, const double* cdata,
                  int words, double btime, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (check_chebyshev_buffer(2, n, degree, cdata, words, frame, segid, err, cap)) return 1;
  spkw02_c(handle, body, center, frame, first, last, segid, intlen, n, degree, cdata, btime);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw03(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, double intlen, int n, int degree, const double* cdata,
                  int words, double btime, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (check_chebyshev_buffer(3, n, degree, cdata, words, frame, segid, err, cap)) return 1;
  spkw03_c(handle, body, center, frame, first, last, segid, intlen, n, degree, cdata, btime);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw20(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, double intlen, int n, int degree, const double* cdata,
                  int words, double dscale, double tscale, double initjd, double initfr, char* err,
                  int cap) {
  tspice_init_cspice_error_handling_once();
  if (check_chebyshev_buffer(20, n, degree, cdata, words, frame, segid, err, cap)) return 1;
  spkw20_c(handle, body, center, frame, first, last, segid, intlen, n, degree, cdata, dscale,
           tscale, initjd, initfr);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

// The type 12, 13 and 18 routines form degree+1 before validating degree.
// Only canonical paths with dimensionally complete data may read the buffers.
static int check_interpolation_storage(int type, int subtype, int degree, int n,
                                       const double* samples, int words, const double* epochs,
                                       int epochCount, char* err, int cap) {
  if (!samples || !epochs || n < 0 || words < 0 || words > 33554432 || epochCount < 0 ||
      epochCount > 33554432)
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid interpolation buffer");
  if (type == 18 && subtype != 0 && subtype != 1) return 0;
  if (type != 9 && degree == INT32_MAX)
    return tspice_ephemeris_invalid_arg(err, cap, "Degree exceeds defined N0067 window arithmetic");
  int stride = type == 18 && subtype == 0 ? 12 : 6;
  if ((int64_t)n * stride != words || (type != 12 && epochCount != n))
    return tspice_ephemeris_invalid_arg(err, cap, "Incomplete interpolation state or epoch buffer");
  for (int i = 0; i < words; ++i)
    if (!isfinite(samples[i]))
      return tspice_ephemeris_invalid_arg(err, cap, "Nonfinite SPK sample");
  for (int i = 0; i < epochCount; ++i)
    if (!isfinite(epochs[i])) return tspice_ephemeris_invalid_arg(err, cap, "Nonfinite SPK epoch");
  return 0;
}

int tspice_spkw09(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int degree, int n, const double* samples, int sampleWords,
                  const double* epochs, int epochCount, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid SPK interpolation arguments");
  if (check_interpolation_storage(9, 1, degree, n, samples, sampleWords, epochs, epochCount, err,
                                  cap))
    return 1;
  spkw09_c(handle, body, center, frame, first, last, segid, degree, n,
           (const SpiceDouble(*)[6])samples, epochs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw12(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int degree, int n, const double* samples, int sampleWords,
                  double epoch0, double step, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last) || !isfinite(epoch0) ||
      !isfinite(step))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid SPK interpolation arguments");
  if (check_interpolation_storage(12, 1, degree, n, samples, sampleWords, samples, 0, err, cap))
    return 1;
  spkw12_c(handle, body, center, frame, first, last, segid, degree, n,
           (const SpiceDouble(*)[6])samples, epoch0, step);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw13(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int degree, int n, const double* samples, int sampleWords,
                  const double* epochs, int epochCount, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid SPK interpolation arguments");
  if (check_interpolation_storage(13, 1, degree, n, samples, sampleWords, epochs, epochCount, err,
                                  cap))
    return 1;
  spkw13_c(handle, body, center, frame, first, last, segid, degree, n,
           (const SpiceDouble(*)[6])samples, epochs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw18(int handle, int subtype, int body, int center, const char* frame, double first,
                  double last, const char* segid, int degree, int n, const double* samples,
                  int sampleWords, const double* epochs, int epochCount, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid SPK interpolation arguments");
  if (check_interpolation_storage(18, subtype, degree, n, samples, sampleWords, epochs, epochCount,
                                  err, cap))
    return 1;
  spkw18_c(handle, (SpiceSPK18Subtype)subtype, body, center, frame, first, last, segid, degree, n,
           samples, epochs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}
