#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <stddef.h>
#include <stdlib.h>
#include <string.h>

#define TSPICE_TIMDEF_VALUE_MAX 1024

static int tspice_time_invalid_arg(char *err, int errMaxBytes, const char *msg) {
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

int tspice_tkvrsn_toolkit(char *out, int outMaxBytes, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }

  if (outMaxBytes > 0 && !out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_tkvrsn_toolkit(): out must not be NULL when outMaxBytes > 0");
  }

  const char *version = tkvrsn_c("TOOLKIT");
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outMaxBytes <= 0) {
    return 0;
  }

  size_t maxPayload = (size_t)outMaxBytes - 1;
  size_t n = strlen(version);
  if (n > maxPayload) {
    n = maxPayload;
  }

  memcpy(out, version, n);
  out[n] = '\0';
  return 0;
}

int tspice_str2et(const char *time, double *outEt, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!time) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_str2et(): time must not be NULL");
  }

  SpiceDouble et = 0.0;
  str2et_c(time, &et);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outEt) {
    *outEt = (double)et;
  }

  return 0;
}

int tspice_et2utc(
    double et,
    const char *format,
    int prec,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_et2utc(): outMaxBytes must be > 0");
  }
  if (!out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_et2utc(): out must not be NULL when outMaxBytes > 0");
  }
  if (!format) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_et2utc(): format must not be NULL");
  }

  et2utc_c((SpiceDouble)et, format, (SpiceInt)prec, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_timout(
    double et,
    const char *picture,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timout(): outMaxBytes must be > 0");
  }
  if (!out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_timout(): out must not be NULL when outMaxBytes > 0");
  }
  if (!picture) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timout(): picture must not be NULL");
  }

  timout_c((SpiceDouble)et, picture, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_deltet(double epoch, const char *eptype, double *outDelta, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outDelta) {
    *outDelta = 0.0;
  }

  if (!eptype) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_deltet(): eptype must not be NULL");
  }

  SpiceDouble delta = 0.0;
  deltet_c((SpiceDouble)epoch, eptype, &delta);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outDelta) {
    *outDelta = (double)delta;
  }

  return 0;
}

int tspice_unitim(
    double epoch,
    const char *insys,
    const char *outsys,
    double *outEpoch,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEpoch) {
    *outEpoch = 0.0;
  }

  if (!insys) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_unitim(): insys must not be NULL");
  }
  if (!outsys) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_unitim(): outsys must not be NULL");
  }

  const SpiceDouble out = unitim_c((SpiceDouble)epoch, insys, outsys);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outEpoch) {
    *outEpoch = (double)out;
  }

  return 0;
}

int tspice_tparse(const char *timstr, double *outEt, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEt) {
    *outEt = 0.0;
  }

  if (!timstr) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_tparse(): timstr must not be NULL");
  }

  SpiceDouble et = 0.0;
  SpiceChar errmsg[2048];
  errmsg[0] = '\0';

  tparse_c(timstr, (SpiceInt)sizeof(errmsg), &et, errmsg);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  // `tparse_c` reports parse failures via `errmsg` (without signaling a SPICE error).
  // Treat these as hard errors so JS can throw.
  if (errmsg[0] != '\0') {
    if (err && errMaxBytes > 0) {
      strncpy(err, errmsg, (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }

    // Parse errors are not CSPICE errors; clear our structured last-error buffers
    // so stale `spiceShort` / `spiceLong` / `spiceTrace` don't leak.
    tspice_clear_last_error_buffers();
    return 1;
  }

  if (outEt) {
    *outEt = (double)et;
  }

  return 0;
}

int tspice_tpictr(
    const char *sample,
    const char *picturIn,
    char *outPictur,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (outPictur && outMaxBytes > 0) {
    outPictur[0] = '\0';
  }
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_tpictr(): outMaxBytes must be > 0");
  }
  if (!outPictur) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_tpictr(): outPictur must not be NULL when outMaxBytes > 0");
  }
  if (!sample) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_tpictr(): sample must not be NULL");
  }

  SpiceInt pictln = (SpiceInt)outMaxBytes;

  // Some higher-level bindings model CSPICE string outputs by accepting an
  // "output template" string. For parity we copy `picturIn` into the output
  // buffer before calling CSPICE, but we do NOT let the template's length
  // reduce `pictln`: in CSPICE `pictln` is the capacity of `pictur`.
  if (picturIn) {
    strncpy(outPictur, picturIn, (size_t)outMaxBytes - 1);
    outPictur[outMaxBytes - 1] = '\0';
  }

  SpiceBoolean ok = SPICETRUE;
  SpiceChar errmsg[2048];
  errmsg[0] = '\0';

  tpictr_c(sample, pictln, (SpiceInt)sizeof(errmsg), outPictur, &ok, errmsg);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  // `tpictr_c` reports problems via `ok`/`errmsg` (without signaling a SPICE error).
  if (ok != SPICETRUE) {
    if (err && errMaxBytes > 0) {
      strncpy(err, errmsg, (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }

    // Non-CSPICE errors: clear our structured last-error buffers.
    tspice_clear_last_error_buffers();
    return 1;
  }

  return 0;
}


int tspice_timdef_get(
    const char *item,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_get(): outMaxBytes must be > 0");
  }
  if (!out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_timdef_get(): out must not be NULL when outMaxBytes > 0");
  }

  if (!item) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_get(): item must not be NULL");
  }

  if (item[0] == '\0') {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_get(): item must be non-empty");
  }

  timdef_c("GET", item, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}


int tspice_timdef_set(const char *item, const char *value, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!item) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_set(): item must not be NULL");
  }
  if (item[0] == '\0') {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_set(): item must be non-empty");
  }

  if (!value) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_set(): value must not be NULL");
  }
  if (value[0] == '\0') {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_set(): value must be non-empty");
  }

  const size_t valueLen = strlen(value);
  if (valueLen >= (size_t)TSPICE_TIMDEF_VALUE_MAX) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_timdef_set(): value too long");
  }

  SpiceChar buf[TSPICE_TIMDEF_VALUE_MAX];
  memcpy(buf, value, valueLen);
  buf[valueLen] = '\0';

  timdef_c("SET", item, (SpiceInt)(valueLen + 1), buf);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_scs2e(
    int sc,
    const char *sclkch,
    double *outEt,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEt) {
    *outEt = 0.0;
  }

  if (!sclkch) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_scs2e(): sclkch must not be NULL");
  }

  SpiceDouble et = 0.0;
  scs2e_c((SpiceInt)sc, sclkch, &et);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outEt) {
    *outEt = (double)et;
  }

  return 0;
}

int tspice_sce2s(
    int sc,
    double et,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_sce2s(): outMaxBytes must be > 0");
  }
  if (!out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_sce2s(): out must not be NULL when outMaxBytes > 0");
  }

  sce2s_c((SpiceInt)sc, (SpiceDouble)et, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_scencd(
    int sc,
    const char *sclkch,
    double *outSclkdp,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outSclkdp) {
    *outSclkdp = 0.0;
  }

  if (!sclkch) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_scencd(): sclkch must not be NULL");
  }

  SpiceDouble sclkdp = 0.0;
  scencd_c((SpiceInt)sc, sclkch, &sclkdp);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outSclkdp) {
    *outSclkdp = (double)sclkdp;
  }

  return 0;
}

int tspice_scdecd(
    int sc,
    double sclkdp,
    char *out,
    int outMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    return tspice_time_invalid_arg(err, errMaxBytes, "tspice_scdecd(): outMaxBytes must be > 0");
  }
  if (!out) {
    return tspice_time_invalid_arg(
        err,
        errMaxBytes,
        "tspice_scdecd(): out must not be NULL when outMaxBytes > 0");
  }

  scdecd_c((SpiceInt)sc, (SpiceDouble)sclkdp, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_sct2e(int sc, double sclkdp, double *outEt, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEt) {
    *outEt = 0.0;
  }

  SpiceDouble et = 0.0;
  sct2e_c((SpiceInt)sc, (SpiceDouble)sclkdp, &et);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outEt) {
    *outEt = (double)et;
  }

  return 0;
}

int tspice_sce2c(int sc, double et, double *outSclkdp, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outSclkdp) {
    *outSclkdp = 0.0;
  }

  SpiceDouble sclkdp = 0.0;
  sce2c_c((SpiceInt)sc, (SpiceDouble)et, &sclkdp);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outSclkdp) {
    *outSclkdp = (double)sclkdp;
  }

  return 0;
}
