#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <stdlib.h>
#include <string.h>

int tspice_tkvrsn_toolkit(char *out, int outMaxBytes, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (errMaxBytes > 0) {
    err[0] = '\0';
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

  if (errMaxBytes > 0) {
    err[0] = '\0';
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

  if (outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    if (errMaxBytes > 0) {
      strncpy(err, "tspice_et2utc(): outMaxBytes must be > 0", (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }
    return 1;
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

  if (outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    if (errMaxBytes > 0) {
      strncpy(err, "tspice_timout(): outMaxBytes must be > 0", (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }
    return 1;
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

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outDelta) {
    *outDelta = 0.0;
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

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEpoch) {
    *outEpoch = 0.0;
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

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEt) {
    *outEt = 0.0;
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
    if (errMaxBytes > 0) {
      strncpy(err, errmsg, (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }

    // Parse errors are not CSPICE errors; clear our structured last-error buffers
    // so stale `spiceShort` / `spiceLong` / `spiceTrace` don't leak.
    tspice_reset(NULL, 0);
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
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!outPictur || outMaxBytes <= 0) {
    if (errMaxBytes > 0) {
      strncpy(err, "tspice_tpictr(): outMaxBytes must be > 0", (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }
    return 1;
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
    if (errMaxBytes > 0) {
      strncpy(err, errmsg, (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }

    // Non-CSPICE errors: clear our structured last-error buffers.
    tspice_reset(NULL, 0);
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

  if (outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    if (errMaxBytes > 0) {
      strncpy(err, "tspice_timdef_get(): outMaxBytes must be > 0", (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }
    return 1;
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

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (!value) {
    value = "";
  }

  const size_t valueLen = strlen(value);
  char *buf = (char *)malloc(valueLen + 1);
  if (!buf) {
    if (errMaxBytes > 0) {
      strncpy(err, "tspice_timdef_set(): malloc failed", (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }
    return 1;
  }

  memcpy(buf, value, valueLen);
  buf[valueLen] = '\0';

  timdef_c("SET", item, (SpiceInt)(valueLen + 1), buf);
  free(buf);

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

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEt) {
    *outEt = 0.0;
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

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out && outMaxBytes > 0) {
    out[0] = '\0';
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

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outSclkdp) {
    *outSclkdp = 0.0;
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

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }

  if (outMaxBytes <= 0) {
    if (errMaxBytes > 0) {
      strncpy(err, "tspice_scdecd(): outMaxBytes must be > 0", (size_t)errMaxBytes - 1);
      err[errMaxBytes - 1] = '\0';
    }
    return 1;
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

  if (errMaxBytes > 0) {
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

  if (errMaxBytes > 0) {
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
