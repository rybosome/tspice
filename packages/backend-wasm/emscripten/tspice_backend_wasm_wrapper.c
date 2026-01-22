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

int tspice_subpnt(
  const char *method,
  const char *target,
  double et,
  const char *fixref,
  const char *abcorr,
  const char *obs,
  double *outSpoint,
  double *outTrgepc,
  double *outSrfvec,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outSpoint) {
    for (int i = 0; i < 3; i++) outSpoint[i] = 0.0;
  }
  if (outTrgepc) *outTrgepc = 0.0;
  if (outSrfvec) {
    for (int i = 0; i < 3; i++) outSrfvec[i] = 0.0;
  }

  SpiceDouble spoint[3] = {0};
  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3] = {0};
  subpnt_c(method, target, (SpiceDouble)et, fixref, abcorr, obs, spoint, &trgepc, srfvec);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outSpoint) {
    for (int i = 0; i < 3; i++) outSpoint[i] = (double)spoint[i];
  }
  if (outTrgepc) *outTrgepc = (double)trgepc;
  if (outSrfvec) {
    for (int i = 0; i < 3; i++) outSrfvec[i] = (double)srfvec[i];
  }
  return 0;
}

int tspice_subslr(
  const char *method,
  const char *target,
  double et,
  const char *fixref,
  const char *abcorr,
  const char *obs,
  double *outSpoint,
  double *outTrgepc,
  double *outSrfvec,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outSpoint) {
    for (int i = 0; i < 3; i++) outSpoint[i] = 0.0;
  }
  if (outTrgepc) *outTrgepc = 0.0;
  if (outSrfvec) {
    for (int i = 0; i < 3; i++) outSrfvec[i] = 0.0;
  }

  SpiceDouble spoint[3] = {0};
  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3] = {0};
  subslr_c(method, target, (SpiceDouble)et, fixref, abcorr, obs, spoint, &trgepc, srfvec);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outSpoint) {
    for (int i = 0; i < 3; i++) outSpoint[i] = (double)spoint[i];
  }
  if (outTrgepc) *outTrgepc = (double)trgepc;
  if (outSrfvec) {
    for (int i = 0; i < 3; i++) outSrfvec[i] = (double)srfvec[i];
  }
  return 0;
}

int tspice_sincpt(
  const char *method,
  const char *target,
  double et,
  const char *fixref,
  const char *abcorr,
  const char *obs,
  const char *dref,
  const double *dvec,
  double *outSpoint,
  double *outTrgepc,
  double *outSrfvec,
  int *foundOut,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outSpoint) {
    for (int i = 0; i < 3; i++) outSpoint[i] = 0.0;
  }
  if (outTrgepc) *outTrgepc = 0.0;
  if (outSrfvec) {
    for (int i = 0; i < 3; i++) outSrfvec[i] = 0.0;
  }
  if (foundOut) *foundOut = 0;

  SpiceDouble dvecC[3] = {0.0, 0.0, 0.0};
  if (dvec) {
    dvecC[0] = dvec[0];
    dvecC[1] = dvec[1];
    dvecC[2] = dvec[2];
  }

  SpiceDouble spoint[3] = {0};
  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3] = {0};
  SpiceBoolean found = SPICEFALSE;
  sincpt_c(
    method,
    target,
    (SpiceDouble)et,
    fixref,
    abcorr,
    obs,
    dref,
    dvecC,
    spoint,
    &trgepc,
    srfvec,
    &found
  );
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outSpoint) {
    for (int i = 0; i < 3; i++) outSpoint[i] = (double)spoint[i];
  }
  if (outTrgepc) *outTrgepc = (double)trgepc;
  if (outSrfvec) {
    for (int i = 0; i < 3; i++) outSrfvec[i] = (double)srfvec[i];
  }
  if (foundOut) *foundOut = found == SPICETRUE ? 1 : 0;
  return 0;
}

int tspice_ilumin(
  const char *method,
  const char *target,
  double et,
  const char *fixref,
  const char *abcorr,
  const char *obs,
  const double *spointIn,
  double *outTrgepc,
  double *outSrfvec,
  double *outPhase,
  double *outSolar,
  double *outEmissn,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outTrgepc) *outTrgepc = 0.0;
  if (outSrfvec) {
    for (int i = 0; i < 3; i++) outSrfvec[i] = 0.0;
  }
  if (outPhase) *outPhase = 0.0;
  if (outSolar) *outSolar = 0.0;
  if (outEmissn) *outEmissn = 0.0;

  SpiceDouble spoint[3] = {0.0, 0.0, 0.0};
  if (spointIn) {
    spoint[0] = spointIn[0];
    spoint[1] = spointIn[1];
    spoint[2] = spointIn[2];
  }
  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3] = {0};
  SpiceDouble phase = 0.0;
  SpiceDouble solar = 0.0;
  SpiceDouble emissn = 0.0;
  ilumin_c(
    method,
    target,
    (SpiceDouble)et,
    fixref,
    abcorr,
    obs,
    spoint,
    &trgepc,
    srfvec,
    &phase,
    &solar,
    &emissn
  );
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outTrgepc) *outTrgepc = (double)trgepc;
  if (outSrfvec) {
    for (int i = 0; i < 3; i++) outSrfvec[i] = (double)srfvec[i];
  }
  if (outPhase) *outPhase = (double)phase;
  if (outSolar) *outSolar = (double)solar;
  if (outEmissn) *outEmissn = (double)emissn;
  return 0;
}

int tspice_occult(
  const char *front,
  const char *fshape,
  const char *fframe,
  const char *back,
  const char *bshape,
  const char *bframe,
  const char *abcorr,
  const char *obs,
  double et,
  int *outCode,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCode) *outCode = 0;

  SpiceInt code = 0;
  occult_c(front, fshape, fframe, back, bshape, bframe, abcorr, obs, (SpiceDouble)et, &code);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outCode) *outCode = (int)code;
  return 0;
}

int tspice_reclat(
  const double *rect,
  double *outRadius,
  double *outLon,
  double *outLat,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outRadius) *outRadius = 0.0;
  if (outLon) *outLon = 0.0;
  if (outLat) *outLat = 0.0;

  SpiceDouble radius = 0.0;
  SpiceDouble lon = 0.0;
  SpiceDouble lat = 0.0;
  SpiceDouble r[3] = {0.0, 0.0, 0.0};
  if (rect) {
    r[0] = rect[0];
    r[1] = rect[1];
    r[2] = rect[2];
  }

  reclat_c(r, &radius, &lon, &lat);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outRadius) *outRadius = (double)radius;
  if (outLon) *outLon = (double)lon;
  if (outLat) *outLat = (double)lat;
  return 0;
}

int tspice_latrec(
  double radius,
  double lon,
  double lat,
  double *outRect,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outRect) {
    for (int i = 0; i < 3; i++) {
      outRect[i] = 0.0;
    }
  }

  SpiceDouble rect[3] = {0.0, 0.0, 0.0};
  latrec_c((SpiceDouble)radius, (SpiceDouble)lon, (SpiceDouble)lat, rect);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outRect) {
    for (int i = 0; i < 3; i++) {
      outRect[i] = (double)rect[i];
    }
  }
  return 0;
}

int tspice_recsph(
  const double *rect,
  double *outRadius,
  double *outColat,
  double *outLon,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outRadius) *outRadius = 0.0;
  if (outColat) *outColat = 0.0;
  if (outLon) *outLon = 0.0;

  SpiceDouble radius = 0.0;
  SpiceDouble colat = 0.0;
  SpiceDouble lon = 0.0;
  SpiceDouble r[3] = {0.0, 0.0, 0.0};
  if (rect) {
    r[0] = rect[0];
    r[1] = rect[1];
    r[2] = rect[2];
  }

  recsph_c(r, &radius, &colat, &lon);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outRadius) *outRadius = (double)radius;
  if (outColat) *outColat = (double)colat;
  if (outLon) *outLon = (double)lon;
  return 0;
}

int tspice_sphrec(
  double radius,
  double colat,
  double lon,
  double *outRect,
  char *err,
  int errMaxBytes
) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outRect) {
    for (int i = 0; i < 3; i++) {
      outRect[i] = 0.0;
    }
  }

  SpiceDouble rect[3] = {0.0, 0.0, 0.0};
  sphrec_c((SpiceDouble)radius, (SpiceDouble)colat, (SpiceDouble)lon, rect);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outRect) {
    for (int i = 0; i < 3; i++) {
      outRect[i] = (double)rect[i];
    }
  }
  return 0;
}

int tspice_vnorm(const double *v, double *out, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out) *out = 0.0;

  SpiceDouble vin[3] = {0.0, 0.0, 0.0};
  if (v) {
    vin[0] = v[0];
    vin[1] = v[1];
    vin[2] = v[2];
  }

  SpiceDouble n = vnorm_c(vin);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (out) *out = (double)n;
  return 0;
}

int tspice_vhat(const double *v, double *out, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out) {
    for (int i = 0; i < 3; i++) out[i] = 0.0;
  }

  SpiceDouble vin[3] = {0.0, 0.0, 0.0};
  if (v) {
    vin[0] = v[0];
    vin[1] = v[1];
    vin[2] = v[2];
  }

  SpiceDouble vout[3] = {0.0, 0.0, 0.0};
  vhat_c(vin, vout);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (out) {
    for (int i = 0; i < 3; i++) out[i] = (double)vout[i];
  }
  return 0;
}

int tspice_vdot(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out) *out = 0.0;

  SpiceDouble ain[3] = {0.0, 0.0, 0.0};
  SpiceDouble bin[3] = {0.0, 0.0, 0.0};
  if (a) {
    ain[0] = a[0];
    ain[1] = a[1];
    ain[2] = a[2];
  }
  if (b) {
    bin[0] = b[0];
    bin[1] = b[1];
    bin[2] = b[2];
  }

  SpiceDouble d = vdot_c(ain, bin);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (out) *out = (double)d;
  return 0;
}

int tspice_vcrss(const double *a, const double *b, double *out, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out) {
    for (int i = 0; i < 3; i++) out[i] = 0.0;
  }

  SpiceDouble ain[3] = {0.0, 0.0, 0.0};
  SpiceDouble bin[3] = {0.0, 0.0, 0.0};
  if (a) {
    ain[0] = a[0];
    ain[1] = a[1];
    ain[2] = a[2];
  }
  if (b) {
    bin[0] = b[0];
    bin[1] = b[1];
    bin[2] = b[2];
  }

  SpiceDouble vout[3] = {0.0, 0.0, 0.0};
  vcrss_c(ain, bin, vout);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (out) {
    for (int i = 0; i < 3; i++) out[i] = (double)vout[i];
  }
  return 0;
}

static void ReadMat33FromFlat9(const double *flat, SpiceDouble m[3][3]) {
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
      m[i][j] = flat ? (SpiceDouble)flat[i * 3 + j] : 0.0;
    }
  }
}

int tspice_mxv(const double *mFlat9, const double *v, double *out, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out) {
    for (int i = 0; i < 3; i++) out[i] = 0.0;
  }

  SpiceDouble m[3][3] = {{0}};
  ReadMat33FromFlat9(mFlat9, m);

  SpiceDouble vin[3] = {0.0, 0.0, 0.0};
  if (v) {
    vin[0] = v[0];
    vin[1] = v[1];
    vin[2] = v[2];
  }

  SpiceDouble vout[3] = {0.0, 0.0, 0.0};
  mxv_c(m, vin, vout);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (out) {
    for (int i = 0; i < 3; i++) out[i] = (double)vout[i];
  }
  return 0;
}

int tspice_mtxv(const double *mFlat9, const double *v, double *out, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out) {
    for (int i = 0; i < 3; i++) out[i] = 0.0;
  }

  SpiceDouble m[3][3] = {{0}};
  ReadMat33FromFlat9(mFlat9, m);

  SpiceDouble vin[3] = {0.0, 0.0, 0.0};
  if (v) {
    vin[0] = v[0];
    vin[1] = v[1];
    vin[2] = v[2];
  }

  SpiceDouble vout[3] = {0.0, 0.0, 0.0};
  mtxv_c(m, vin, vout);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (out) {
    for (int i = 0; i < 3; i++) out[i] = (double)vout[i];
  }
  return 0;
}
