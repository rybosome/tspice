#include <math.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "../handle_validation.h"
#include "SpiceZfc.h"
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

// SGSEQW has 20 generic writer slots per CSPICE instance. The Node addon holds
// its CSPICE mutex across every access. WASM has a separate table per module.
typedef struct {
  int used, handle, width;
  int64_t packets;
  int start;
} Spk14Stream;
static Spk14Stream spk14_streams[20];
static int spk14_last_handle;
static Spk14Stream* spk14_slot(int handle) {
  for (int i = 0; i < 20; i++)
    if (spk14_streams[i].used && spk14_streams[i].handle == handle) return &spk14_streams[i];
  return NULL;
}
static int spk14_count(void) {
  int n = 0;
  for (int i = 0; i < 20; i++)
    if (spk14_streams[i].used) n++;
  return n;
}
static int stream_problem(char* err, int cap) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, cap);
  return 1;
}
static int spk14_unfinished(int handle, char* err, int cap) {
  return spk14_slot(handle) ? tspice_ephemeris_invalid_arg(
                                  err, cap, "Complete the active type 14 segment with spk14e first")
                            : 0;
}

// Type 10 and 14 both use the same SGSEQW table. SGBWFS overwrites its
// saved index during certain failed lookups. Protect live entries while
// allowing a complete type 10 segment to be written to a different file.
static int generic_begin_guard(int handle, const char* id, int streaming, char* err, int cap) {
  int active = spk14_count();
  if (!active) return 0;
  if (spk14_slot(handle)) {
    if (streaming && handle == spk14_last_handle) return 0;  // canonical duplicate-begin diagnostic
    return tspice_ephemeris_invalid_arg(err, cap,
                                        "Finish the active type 14 segment with spk14e first");
  }
  size_t length = strlen(id);
  while (length && id[length - 1] == ' ') --length;
  if (length > 40)
    return tspice_ephemeris_invalid_arg(
        err, cap, "Invalid generic segment ID while a type 14 writer is active");
  for (size_t i = 0; i < length; i++)
    if ((unsigned char)id[i] < 32 || (unsigned char)id[i] > 126)
      return tspice_ephemeris_invalid_arg(
          err, cap, "Invalid generic segment ID while a type 14 writer is active");
  if (active == 20)
    return tspice_ephemeris_invalid_arg(err, cap, "All generic writer slots are active");
  return 0;
}
int tspice_spkcls(int handle, char *err, int errMaxBytes) {
  if(spk14_unfinished(handle,err,errMaxBytes))return 1;
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
  if(spk14_unfinished(handle,err,errMaxBytes))return 1;
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
  if(spk14_unfinished(handle,err,cap))return 1;
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
  if(spk14_unfinished(handle,err,cap))return 1;
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
  if(spk14_unfinished(handle,err,cap))return 1;
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

// The packed transport is limited to 256 MiB on both backends. Slice offsets
// below are reached only after proving the complete physical dimensions.
static int check_analytic_spk(int type, int n, const double* data, int words, char* err, int cap) {
  int64_t required = type == 5    ? 1 + 7 * (int64_t)n
                     : type == 10 ? 8 + 11 * (int64_t)n
                     : type == 15 ? 16
                                  : 12;
  if (!data || n < 0 || words < 0 || words > 33554432 || required != words ||
      ((type == 15 || type == 17) && n != 1))
    return tspice_ephemeris_invalid_arg(err, cap, "Incomplete analytic SPK data");
  for (int i = 0; i < words; ++i)
    if (!isfinite(data[i]))
      return tspice_ephemeris_invalid_arg(err, cap, "Nonfinite analytic SPK data");
  if (type == 10) {
    const double* epochs = data + 8 + 10 * (int64_t)n;
    for (int i = 1; i < n; ++i)
      if (epochs[i - 1] >= epochs[i])
        return tspice_ephemeris_invalid_arg(
            err, cap, "Type 10 epochs must increase before opening a generic segment");
  }
  if (type == 15 && (trunc(data[9]) < (double)INT32_MIN || trunc(data[9]) > (double)INT32_MAX))
    return tspice_ephemeris_invalid_arg(err, cap,
                                        "Type 15 J2 flag exceeds signed evaluation range");
  return 0;
}

int tspice_spkw05(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int n, const double* data, int words, char* err, int cap) {
  if(spk14_unfinished(handle,err,cap))return 1;
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid analytic SPK descriptor");
  if (check_analytic_spk(5, n, data, words, err, cap)) return 1;
  spkw05_c(handle, body, center, frame, first, last, segid, data[0], n,
           (const SpiceDouble(*)[6])(data + 1), data + 1 + 6 * n);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw10(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int n, const double* data, int words, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid analytic SPK descriptor");
  if (check_analytic_spk(10, n, data, words, err, cap)) return 1;
  if (generic_begin_guard(handle, segid, 0, err, cap)) return 1;
  // A descriptor error can happen before the generic writer is touched.
  // Conservatively clear the optional same-handle shortcut in either case.
  if (spk14_count()) spk14_last_handle = 0;
  spkw10_c(handle, body, center, frame, first, last, segid, data, n, data + 8, data + 8 + 10 * n);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw15(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int n, const double* data, int words, char* err, int cap) {
  if(spk14_unfinished(handle,err,cap))return 1;
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid analytic SPK descriptor");
  if (check_analytic_spk(15, n, data, words, err, cap)) return 1;
  spkw15_c(handle, body, center, frame, first, last, segid, data[0], data + 1, data + 4, data[7],
           data[8], data[9], data + 10, data[13], data[14], data[15]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spkw17(int handle, int body, int center, const char* frame, double first, double last,
                  const char* segid, int n, const double* data, int words, char* err, int cap) {
  if(spk14_unfinished(handle,err,cap))return 1;
  tspice_init_cspice_error_handling_once();
  if (!frame || !segid || !isfinite(first) || !isfinite(last))
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid analytic SPK descriptor");
  if (check_analytic_spk(17, n, data, words, err, cap)) return 1;
  spkw17_c(handle, body, center, frame, first, last, segid, data[0], data + 1, data[10], data[11]);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, cap);
    return 1;
  }
  return 0;
}

int tspice_spk14b(int handle, const char* segid, int body, int center, const char* frame,
                  double first, double last, int degree, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!segid || !frame || !isfinite(first) || !isfinite(last) || degree > 357913939)
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid type 14 descriptor or record width");
  if (generic_begin_guard(handle, segid, 1, err, cap)) return 1;
  int start = 0;
  if (degree >= 0 && frame[0] && segid[0]) {
    SpiceInt nd, ni, forward, back, freeAddress;
    char name[2];
    dafrfr_c(handle, sizeof(name), &nd, &ni, name, &forward, &back, &freeAddress);
    if (stream_problem(err, cap)) return 1;
    start = freeAddress;
  }
  spk14b_c(handle, segid, body, center, frame, first, last, degree);
  if (stream_problem(err, cap)) return 1;
  spk14_last_handle = handle;
  for (int i = 0; i < 20; i++)
    if (!spk14_streams[i].used) {
      spk14_streams[i] = (Spk14Stream){1, handle, 2 + 6 * (degree + 1), 0, start};
      return 0;
    }
  return tspice_ephemeris_invalid_arg(err, cap, "Missing type 14 slot after begin");
}

int tspice_spk14a(int handle, int count, const double* records, int words, const double* epochs,
                  int nEpochs, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  if (!records || !epochs || words < 0 || nEpochs < 0 || (int64_t)words + nEpochs > 33554432)
    return tspice_ephemeris_invalid_arg(err, cap, "Invalid type 14 packet buffers");
  Spk14Stream* stream = spk14_slot(handle);
  if (count > 0 && !stream && spk14_count())
    return tspice_ephemeris_invalid_arg(err, cap, "No active type 14 segment for this writer");
  if (stream && count > 0) {
    if ((int64_t)stream->width * count != words || nEpochs != count)
      return tspice_ephemeris_invalid_arg(err, cap, "Incomplete type 14 record or epoch buffer");
    int64_t total = stream->packets + count;
    // Include the leading constant, an explicit reference and its duplicate directory,
    // every hundredth reference, the 17 metadata words and signed intermediate offsets.
    if ((int64_t)stream->start + 256 + total * (stream->width + 2LL) + total / 100 + 20 > INT32_MAX)
      return tspice_ephemeris_invalid_arg(err, cap, "Type 14 segment exceeds signed DAF indexing");
    for (int i = 0; i < words; ++i)
      if (!isfinite(records[i]))
        return tspice_ephemeris_invalid_arg(err, cap, "Nonfinite type 14 packet word");
    for (int i = 0; i < nEpochs; ++i)
      if (!isfinite(epochs[i]))
        return tspice_ephemeris_invalid_arg(err, cap, "Nonfinite type 14 epoch");
    // A batch writer on another file can change the current DAF array without
    // changing SGSEQW's cached handle. Select this active physical array again.
    SpiceInt file = handle;
    dafcad_(&file);
    if (stream_problem(err, cap)) return 1;
  }
  if (stream && count > 0) spk14_last_handle = handle;
  spk14a_c(handle, count, records, epochs);
  if (stream_problem(err, cap)) return 1;
  if (stream) stream->packets += count;
  return 0;
}

int tspice_spk14e(int handle, char* err, int cap) {
  tspice_init_cspice_error_handling_once();
  Spk14Stream* stream = spk14_slot(handle);
  if (!stream && spk14_count())
    return tspice_ephemeris_invalid_arg(err, cap, "No active type 14 segment for this writer");
  if (stream) {
    SpiceInt file = handle;
    dafcad_(&file);
    if (stream_problem(err, cap)) return 1;
  }
  if (stream) spk14_last_handle = handle;
  spk14e_c(handle);
  if (stream_problem(err, cap)) return 1;
  if (stream) stream->used = 0;
  return 0;
}

// Disposal finishes only a segment actually held by this writable DAF.
int tspice_spk14_finish_if_active(int handle, char* err, int cap) {
  return spk14_slot(handle) ? tspice_spk14e(handle, err, cap) : 0;
}
