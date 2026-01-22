#include "SpiceUsr.h"

#include <stdbool.h>
#include <string.h>

static bool g_initialized = false;

static void InitCspiceErrorHandlingOnce(void) {
  if (g_initialized) {
    return;
  }

  erract_c("SET", 0, "RETURN");
  errprt_c("SET", 0, "NONE");
  g_initialized = true;
}

static void GetSpiceErrorMessageAndReset(char *out, int outMaxBytes) {
  if (outMaxBytes <= 0) {
    reset_c();
    return;
  }

  out[0] = '\0';

  SpiceChar shortMsg[1841];
  SpiceChar longMsg[1841];
  getmsg_c("SHORT", (SpiceInt)sizeof(shortMsg), shortMsg);
  getmsg_c("LONG", (SpiceInt)sizeof(longMsg), longMsg);
  reset_c();

  const char *sep = "\n";
  const size_t sepLen = strlen(sep);

  size_t shortLen = strlen(shortMsg);
  size_t longLen = strlen(longMsg);
  size_t maxPayload = (size_t)outMaxBytes - 1;

  size_t pos = 0;

  if (shortLen > 0) {
    size_t n = shortLen > maxPayload ? maxPayload : shortLen;
    memcpy(out + pos, shortMsg, n);
    pos += n;
  }

  if (pos + sepLen < maxPayload && longLen > 0) {
    memcpy(out + pos, sep, sepLen);
    pos += sepLen;
  }

  if (longLen > 0 && pos < maxPayload) {
    size_t remaining = maxPayload - pos;
    size_t n = longLen > remaining ? remaining : longLen;
    memcpy(out + pos, longMsg, n);
    pos += n;
  }

  out[pos] = '\0';
}

int tspice_tkvrsn_toolkit(char *out, int outMaxBytes, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (outMaxBytes > 0) {
    out[0] = '\0';
  }
  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  const char *version = tkvrsn_c("TOOLKIT");
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
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

int tspice_furnsh(const char *path, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  furnsh_c(path);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_unload(const char *path, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  unload_c(path);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_kclear(char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  kclear_c();
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_ktotal(const char *kind, int *outCount, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCount) {
    *outCount = 0;
  }

  SpiceInt count = 0;
  ktotal_c(kind, &count);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outCount) {
    *outCount = (int)count;
  }

  return 0;
}

int tspice_kdata(
  int which,
  const char *kind,
  char *file,
  int fileMaxBytes,
  char *filtyp,
  int filtypMaxBytes,
  char *source,
  int sourceMaxBytes,
  int *handle,
  int *foundOut,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (fileMaxBytes > 0 && file) {
    file[0] = '\0';
  }
  if (filtypMaxBytes > 0 && filtyp) {
    filtyp[0] = '\0';
  }
  if (sourceMaxBytes > 0 && source) {
    source[0] = '\0';
  }
  if (handle) {
    *handle = 0;
  }
  if (foundOut) {
    *foundOut = 0;
  }

  SpiceInt handleC = 0;
  SpiceBoolean foundC = SPICEFALSE;

  kdata_c(
    (SpiceInt)which,
    kind,
    (SpiceInt)fileMaxBytes,
    (SpiceInt)filtypMaxBytes,
    (SpiceInt)sourceMaxBytes,
    file,
    filtyp,
    source,
    &handleC,
    &foundC
  );

  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (handle) {
    *handle = (int)handleC;
  }
  if (foundOut) {
    *foundOut = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_str2et(const char *utc, double *outEt, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEt) {
    *outEt = 0.0;
  }

  SpiceDouble et = 0.0;
  str2et_c(utc, &et);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
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
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outMaxBytes > 0 && out) {
    out[0] = '\0';
  }

  et2utc_c((SpiceDouble)et, format, (SpiceInt)prec, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
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
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outMaxBytes > 0 && out) {
    out[0] = '\0';
  }

  timout_c((SpiceDouble)et, picture, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_bodn2c(const char *name, int *outCode, int *foundOut, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCode) {
    *outCode = 0;
  }
  if (foundOut) {
    *foundOut = 0;
  }

  SpiceInt code = 0;
  SpiceBoolean found = SPICEFALSE;
  bodn2c_c(name, &code, &found);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outCode) {
    *outCode = (int)code;
  }
  if (foundOut) {
    *foundOut = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_bodc2n(
  int code,
  char *outName,
  int outNameMaxBytes,
  int *foundOut,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outNameMaxBytes > 0 && outName) {
    outName[0] = '\0';
  }
  if (foundOut) {
    *foundOut = 0;
  }

  SpiceBoolean found = SPICEFALSE;
  bodc2n_c((SpiceInt)code, (SpiceInt)outNameMaxBytes, outName, &found);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (foundOut) {
    *foundOut = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_namfrm(const char *frameName, int *outFrameId, int *foundOut, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrameId) {
    *outFrameId = 0;
  }
  if (foundOut) {
    *foundOut = 0;
  }

  SpiceInt frameId = 0;
  // CSPICE N0067 `namfrm_c` signature is:
  //   void namfrm_c ( ConstSpiceChar *frname, SpiceInt *frcode );
  // It does not provide an explicit "found" output.
  // Convention: a frame code of 0 means "not found".
  namfrm_c(frameName, &frameId);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outFrameId) {
    *outFrameId = (int)frameId;
  }
  if (foundOut) {
    *foundOut = frameId != 0 ? 1 : 0;
  }

  return 0;
}

int tspice_frmnam(
  int frameId,
  char *outFrameName,
  int outFrameNameMaxBytes,
  int *foundOut,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrameNameMaxBytes > 0 && outFrameName) {
    outFrameName[0] = '\0';
  }
  if (foundOut) {
    *foundOut = 0;
  }

  frmnam_c((SpiceInt)frameId, (SpiceInt)outFrameNameMaxBytes, outFrameName);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  // frmnam_c returns an empty string when not found.
  if (foundOut) {
    *foundOut = (outFrameName && outFrameName[0] != '\0') ? 1 : 0;
  }

  return 0;
}

int tspice_cidfrm(
  int center,
  int *outFrcode,
  char *outFrname,
  int outFrnameMaxBytes,
  int *foundOut,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrcode) {
    *outFrcode = 0;
  }
  if (outFrnameMaxBytes > 0 && outFrname) {
    outFrname[0] = '\0';
  }
  if (foundOut) {
    *foundOut = 0;
  }

  SpiceInt frcode = 0;
  SpiceBoolean found = SPICEFALSE;

  cidfrm_c(
    (SpiceInt)center,
    (SpiceInt)outFrnameMaxBytes,
    &frcode,
    outFrname,
    &found
  );
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outFrcode) {
    *outFrcode = (int)frcode;
  }
  if (foundOut) {
    *foundOut = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_cnmfrm(
  const char *centerName,
  int *outFrcode,
  char *outFrname,
  int outFrnameMaxBytes,
  int *foundOut,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrcode) {
    *outFrcode = 0;
  }
  if (outFrnameMaxBytes > 0 && outFrname) {
    outFrname[0] = '\0';
  }
  if (foundOut) {
    *foundOut = 0;
  }

  SpiceInt frcode = 0;
  SpiceBoolean found = SPICEFALSE;

  cnmfrm_c(
    centerName,
    (SpiceInt)outFrnameMaxBytes,
    &frcode,
    outFrname,
    &found
  );
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outFrcode) {
    *outFrcode = (int)frcode;
  }
  if (foundOut) {
    *foundOut = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_scs2e(int sc, const char *sclkch, double *outEt, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outEt) {
    *outEt = 0.0;
  }

  SpiceDouble et = 0.0;
  scs2e_c((SpiceInt)sc, sclkch, &et);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
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
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outMaxBytes > 0 && out) {
    out[0] = '\0';
  }

  // Output length must include the terminating NUL.
  sce2s_c((SpiceInt)sc, (SpiceDouble)et, (SpiceInt)outMaxBytes, out);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_ckgp(
  int inst,
  double sclkdp,
  double tol,
  const char *ref,
  double *outCmat,
  double *outClkout,
  int *foundOut,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCmat) {
    for (int i = 0; i < 9; i++) {
      outCmat[i] = 0.0;
    }
  }
  if (outClkout) {
    *outClkout = 0.0;
  }
  if (foundOut) {
    *foundOut = 0;
  }

  SpiceDouble cmat[3][3] = {{0}};
  SpiceDouble clkout = 0.0;
  SpiceBoolean found = SPICEFALSE;

  ckgp_c((SpiceInt)inst, (SpiceDouble)sclkdp, (SpiceDouble)tol, ref, cmat, &clkout, &found);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outCmat) {
    for (int i = 0; i < 3; i++) {
      for (int j = 0; j < 3; j++) {
        outCmat[i * 3 + j] = (double)cmat[i][j];
      }
    }
  }
  if (outClkout) {
    *outClkout = (double)clkout;
  }
  if (foundOut) {
    *foundOut = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_ckgpav(
  int inst,
  double sclkdp,
  double tol,
  const char *ref,
  double *outCmat,
  double *outAv,
  double *outClkout,
  int *foundOut,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCmat) {
    for (int i = 0; i < 9; i++) {
      outCmat[i] = 0.0;
    }
  }
  if (outAv) {
    for (int i = 0; i < 3; i++) {
      outAv[i] = 0.0;
    }
  }
  if (outClkout) {
    *outClkout = 0.0;
  }
  if (foundOut) {
    *foundOut = 0;
  }

  SpiceDouble cmat[3][3] = {{0}};
  SpiceDouble av[3] = {0};
  SpiceDouble clkout = 0.0;
  SpiceBoolean found = SPICEFALSE;

  ckgpav_c(
    (SpiceInt)inst,
    (SpiceDouble)sclkdp,
    (SpiceDouble)tol,
    ref,
    cmat,
    av,
    &clkout,
    &found
  );
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outCmat) {
    for (int i = 0; i < 3; i++) {
      for (int j = 0; j < 3; j++) {
        outCmat[i * 3 + j] = (double)cmat[i][j];
      }
    }
  }
  if (outAv) {
    for (int i = 0; i < 3; i++) {
      outAv[i] = (double)av[i];
    }
  }
  if (outClkout) {
    *outClkout = (double)clkout;
  }
  if (foundOut) {
    *foundOut = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_pxform(
  const char *from,
  const char *to,
  double et,
  double *out,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out) {
    for (int i = 0; i < 9; i++) {
      out[i] = 0.0;
    }
  }

  SpiceDouble rot[3][3] = {{0}};
  pxform_c(from, to, (SpiceDouble)et, rot);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (out) {
    for (int i = 0; i < 3; i++) {
      for (int j = 0; j < 3; j++) {
        out[i * 3 + j] = (double)rot[i][j];
      }
    }
  }

  return 0;
}

int tspice_sxform(
  const char *from,
  const char *to,
  double et,
  double *out,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out) {
    for (int i = 0; i < 36; i++) {
      out[i] = 0.0;
    }
  }

  SpiceDouble xform[6][6] = {{0}};
  sxform_c(from, to, (SpiceDouble)et, xform);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (out) {
    for (int i = 0; i < 6; i++) {
      for (int j = 0; j < 6; j++) {
        out[i * 6 + j] = (double)xform[i][j];
      }
    }
  }

  return 0;
}

int tspice_spkezr(
  const char *target,
  double et,
  const char *ref,
  const char *abcorr,
  const char *obs,
  double *outState,
  double *outLt,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outState) {
    for (int i = 0; i < 6; i++) {
      outState[i] = 0.0;
    }
  }
  if (outLt) {
    *outLt = 0.0;
  }

  SpiceDouble state[6] = {0};
  SpiceDouble lt = 0.0;
  spkezr_c(target, (SpiceDouble)et, ref, abcorr, obs, state, &lt);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outState) {
    for (int i = 0; i < 6; i++) {
      outState[i] = (double)state[i];
    }
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
  const char *obs,
  double *outPos,
  double *outLt,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outPos) {
    for (int i = 0; i < 3; i++) {
      outPos[i] = 0.0;
    }
  }
  if (outLt) {
    *outLt = 0.0;
  }

  SpiceDouble pos[3] = {0};
  SpiceDouble lt = 0.0;
  spkpos_c(target, (SpiceDouble)et, ref, abcorr, obs, pos, &lt);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outPos) {
    for (int i = 0; i < 3; i++) {
      outPos[i] = (double)pos[i];
    }
  }
  if (outLt) {
    *outLt = (double)lt;
  }

  return 0;
}
