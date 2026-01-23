#include "tspice_backend_shim.h"

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
    int *outHandle,
    int *outFound,
    char *err,
    int errMaxBytes) {
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
  if (outHandle) {
    *outHandle = 0;
  }
  if (outFound) {
    *outFound = 0;
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
      &foundC);

  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outHandle) {
    *outHandle = (int)handleC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_ktotal_all(char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceInt count = 0;
  ktotal_c("ALL", &count);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return -1;
  }

  return (int)count;
}

int tspice_str2et(const char *time, double *outEt, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble et = 0.0;
  str2et_c(time, &et);
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
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

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
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

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
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_bodn2c(
    const char *name,
    int *outCode,
    int *outFound,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCode) {
    *outCode = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt codeC = 0;
  SpiceBoolean foundC = SPICEFALSE;
  bodn2c_c(name, &codeC, &foundC);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outCode) {
    *outCode = (int)codeC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_bodc2n(
    int code,
    char *outName,
    int outNameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outNameMaxBytes > 0 && outName) {
    outName[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceBoolean foundC = SPICEFALSE;
  bodc2n_c((SpiceInt)code, (SpiceInt)outNameMaxBytes, outName, &foundC);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_namfrm(
    const char *frameName,
    int *outFrameId,
    int *outFound,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrameId) {
    *outFrameId = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt frameId = 0;
  namfrm_c(frameName, &frameId);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outFrameId) {
    *outFrameId = (int)frameId;
  }
  if (outFound) {
    *outFound = frameId != 0 ? 1 : 0;
  }

  return 0;
}

int tspice_frmnam(
    int frameId,
    char *outFrameName,
    int outFrameNameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFrameNameMaxBytes > 0 && outFrameName) {
    outFrameName[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }

  frmnam_c((SpiceInt)frameId, (SpiceInt)outFrameNameMaxBytes, outFrameName);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = (outFrameName && outFrameName[0] != '\0') ? 1 : 0;
  }

  return 0;
}

int tspice_cidfrm(
    int center,
    int *outFrcode,
    char *outFrname,
    int outFrnameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
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
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt frcode = 0;
  SpiceChar frname[32] = {0};
  SpiceBoolean found = SPICEFALSE;

  cidfrm_c((SpiceInt)center, (SpiceInt)sizeof(frname), &frcode, frname, &found);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outFrcode) {
    *outFrcode = (int)frcode;
  }

  if (outFrname && outFrnameMaxBytes > 0) {
    strncpy(outFrname, frname, (size_t)outFrnameMaxBytes - 1);
    outFrname[outFrnameMaxBytes - 1] = '\0';
  }

  if (outFound) {
    *outFound = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_cnmfrm(
    const char *centerName,
    int *outFrcode,
    char *outFrname,
    int outFrnameMaxBytes,
    int *outFound,
    char *err,
    int errMaxBytes) {
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
  if (outFound) {
    *outFound = 0;
  }

  SpiceInt frcode = 0;
  SpiceChar frname[32] = {0};
  SpiceBoolean found = SPICEFALSE;

  cnmfrm_c(centerName, (SpiceInt)sizeof(frname), &frcode, frname, &found);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outFrcode) {
    *outFrcode = (int)frcode;
  }

  if (outFrname && outFrnameMaxBytes > 0) {
    strncpy(outFrname, frname, (size_t)outFrnameMaxBytes - 1);
    outFrname[outFrnameMaxBytes - 1] = '\0';
  }

  if (outFound) {
    *outFound = found == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_pxform(
    const char *from,
    const char *to,
    double et,
    double *outMatrix3x3,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble m[3][3];
  pxform_c(from, to, (SpiceDouble)et, m);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outMatrix3x3) {
    outMatrix3x3[0] = (double)m[0][0];
    outMatrix3x3[1] = (double)m[0][1];
    outMatrix3x3[2] = (double)m[0][2];

    outMatrix3x3[3] = (double)m[1][0];
    outMatrix3x3[4] = (double)m[1][1];
    outMatrix3x3[5] = (double)m[1][2];

    outMatrix3x3[6] = (double)m[2][0];
    outMatrix3x3[7] = (double)m[2][1];
    outMatrix3x3[8] = (double)m[2][2];
  }

  return 0;
}

int tspice_sxform(
    const char *from,
    const char *to,
    double et,
    double *outMatrix6x6,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble m[6][6];
  sxform_c(from, to, (SpiceDouble)et, m);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outMatrix6x6) {
    int i;
    int j;
    for (i = 0; i < 6; i++) {
      for (j = 0; j < 6; j++) {
        outMatrix6x6[i * 6 + j] = (double)m[i][j];
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
    const char *observer,
    double *outState6,
    double *outLt,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble state[6];
  SpiceDouble lt = 0.0;
  spkezr_c(target, (SpiceDouble)et, ref, abcorr, observer, state, &lt);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
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
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble pos[3];
  SpiceDouble lt = 0.0;
  spkpos_c(target, (SpiceDouble)et, ref, abcorr, observer, pos, &lt);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
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

int tspice_subpnt(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    double *outSpoint3,
    double *outTrgepc,
    double *outSrfvec3,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outTrgepc) {
    *outTrgepc = 0.0;
  }

  SpiceDouble spoint[3];
  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3];
  subpnt_c(method, target, (SpiceDouble)et, fixref, abcorr, observer, spoint, &trgepc, srfvec);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outSpoint3) {
    outSpoint3[0] = (double)spoint[0];
    outSpoint3[1] = (double)spoint[1];
    outSpoint3[2] = (double)spoint[2];
  }
  if (outTrgepc) {
    *outTrgepc = (double)trgepc;
  }
  if (outSrfvec3) {
    outSrfvec3[0] = (double)srfvec[0];
    outSrfvec3[1] = (double)srfvec[1];
    outSrfvec3[2] = (double)srfvec[2];
  }

  return 0;
}

int tspice_subslr(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    double *outSpoint3,
    double *outTrgepc,
    double *outSrfvec3,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outTrgepc) {
    *outTrgepc = 0.0;
  }

  SpiceDouble spoint[3];
  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3];
  subslr_c(method, target, (SpiceDouble)et, fixref, abcorr, observer, spoint, &trgepc, srfvec);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outSpoint3) {
    outSpoint3[0] = (double)spoint[0];
    outSpoint3[1] = (double)spoint[1];
    outSpoint3[2] = (double)spoint[2];
  }
  if (outTrgepc) {
    *outTrgepc = (double)trgepc;
  }
  if (outSrfvec3) {
    outSrfvec3[0] = (double)srfvec[0];
    outSrfvec3[1] = (double)srfvec[1];
    outSrfvec3[2] = (double)srfvec[2];
  }

  return 0;
}

int tspice_sincpt(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    const char *dref,
    const double *dvec3,
    double *outSpoint3,
    double *outTrgepc,
    double *outSrfvec3,
    int *outFound,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outTrgepc) {
    *outTrgepc = 0.0;
  }
  if (outFound) {
    *outFound = 0;
  }

  SpiceDouble dvec[3];
  dvec[0] = dvec3 ? (SpiceDouble)dvec3[0] : 0.0;
  dvec[1] = dvec3 ? (SpiceDouble)dvec3[1] : 0.0;
  dvec[2] = dvec3 ? (SpiceDouble)dvec3[2] : 0.0;

  SpiceDouble spoint[3];
  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3];
  SpiceBoolean found = SPICEFALSE;

  sincpt_c(method, target, (SpiceDouble)et, fixref, abcorr, observer, dref, dvec, spoint, &trgepc, srfvec, &found);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = found == SPICETRUE ? 1 : 0;
  }

  if (found == SPICETRUE) {
    if (outSpoint3) {
      outSpoint3[0] = (double)spoint[0];
      outSpoint3[1] = (double)spoint[1];
      outSpoint3[2] = (double)spoint[2];
    }
    if (outTrgepc) {
      *outTrgepc = (double)trgepc;
    }
    if (outSrfvec3) {
      outSrfvec3[0] = (double)srfvec[0];
      outSrfvec3[1] = (double)srfvec[1];
      outSrfvec3[2] = (double)srfvec[2];
    }
  }

  return 0;
}

int tspice_ilumin(
    const char *method,
    const char *target,
    double et,
    const char *fixref,
    const char *abcorr,
    const char *observer,
    const double *spoint3,
    double *outTrgepc,
    double *outSrfvec3,
    double *outPhase,
    double *outIncdnc,
    double *outEmissn,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outTrgepc) {
    *outTrgepc = 0.0;
  }
  if (outPhase) {
    *outPhase = 0.0;
  }
  if (outIncdnc) {
    *outIncdnc = 0.0;
  }
  if (outEmissn) {
    *outEmissn = 0.0;
  }

  SpiceDouble spoint[3];
  spoint[0] = spoint3 ? (SpiceDouble)spoint3[0] : 0.0;
  spoint[1] = spoint3 ? (SpiceDouble)spoint3[1] : 0.0;
  spoint[2] = spoint3 ? (SpiceDouble)spoint3[2] : 0.0;

  SpiceDouble trgepc = 0.0;
  SpiceDouble srfvec[3];
  SpiceDouble phase = 0.0;
  SpiceDouble incdnc = 0.0;
  SpiceDouble emissn = 0.0;

  ilumin_c(method, target, (SpiceDouble)et, fixref, abcorr, observer, spoint, &trgepc, srfvec, &phase, &incdnc, &emissn);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outTrgepc) {
    *outTrgepc = (double)trgepc;
  }
  if (outSrfvec3) {
    outSrfvec3[0] = (double)srfvec[0];
    outSrfvec3[1] = (double)srfvec[1];
    outSrfvec3[2] = (double)srfvec[2];
  }
  if (outPhase) {
    *outPhase = (double)phase;
  }
  if (outIncdnc) {
    *outIncdnc = (double)incdnc;
  }
  if (outEmissn) {
    *outEmissn = (double)emissn;
  }

  return 0;
}

int tspice_occult(
    const char *targ1,
    const char *shape1,
    const char *frame1,
    const char *targ2,
    const char *shape2,
    const char *frame2,
    const char *abcorr,
    const char *observer,
    double et,
    int *outOcltid,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outOcltid) {
    *outOcltid = 0;
  }

  SpiceInt ocltid = 0;
  occult_c(targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer, (SpiceDouble)et, &ocltid);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outOcltid) {
    *outOcltid = (int)ocltid;
  }
  return 0;
}

int tspice_reclat(
    const double *rect3,
    double *outRadius,
    double *outLon,
    double *outLat,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outRadius) {
    *outRadius = 0.0;
  }
  if (outLon) {
    *outLon = 0.0;
  }
  if (outLat) {
    *outLat = 0.0;
  }

  SpiceDouble rect[3] = {0.0, 0.0, 0.0};
  if (rect3) {
    rect[0] = (SpiceDouble)rect3[0];
    rect[1] = (SpiceDouble)rect3[1];
    rect[2] = (SpiceDouble)rect3[2];
  }

  SpiceDouble radius = 0.0;
  SpiceDouble lon = 0.0;
  SpiceDouble lat = 0.0;
  reclat_c(rect, &radius, &lon, &lat);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outRadius) {
    *outRadius = (double)radius;
  }
  if (outLon) {
    *outLon = (double)lon;
  }
  if (outLat) {
    *outLat = (double)lat;
  }

  return 0;
}

int tspice_latrec(
    double radius,
    double lon,
    double lat,
    double *outRect3,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble rect[3] = {0.0, 0.0, 0.0};
  latrec_c((SpiceDouble)radius, (SpiceDouble)lon, (SpiceDouble)lat, rect);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outRect3) {
    outRect3[0] = (double)rect[0];
    outRect3[1] = (double)rect[1];
    outRect3[2] = (double)rect[2];
  }

  return 0;
}

int tspice_recsph(
    const double *rect3,
    double *outRadius,
    double *outColat,
    double *outLon,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outRadius) {
    *outRadius = 0.0;
  }
  if (outColat) {
    *outColat = 0.0;
  }
  if (outLon) {
    *outLon = 0.0;
  }

  SpiceDouble rect[3] = {0.0, 0.0, 0.0};
  if (rect3) {
    rect[0] = (SpiceDouble)rect3[0];
    rect[1] = (SpiceDouble)rect3[1];
    rect[2] = (SpiceDouble)rect3[2];
  }

  SpiceDouble radius = 0.0;
  SpiceDouble colat = 0.0;
  SpiceDouble lon = 0.0;
  recsph_c(rect, &radius, &colat, &lon);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outRadius) {
    *outRadius = (double)radius;
  }
  if (outColat) {
    *outColat = (double)colat;
  }
  if (outLon) {
    *outLon = (double)lon;
  }

  return 0;
}

int tspice_sphrec(
    double radius,
    double colat,
    double lon,
    double *outRect3,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble rect[3] = {0.0, 0.0, 0.0};
  sphrec_c((SpiceDouble)radius, (SpiceDouble)colat, (SpiceDouble)lon, rect);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outRect3) {
    outRect3[0] = (double)rect[0];
    outRect3[1] = (double)rect[1];
    outRect3[2] = (double)rect[2];
  }

  return 0;
}

int tspice_vnorm(const double *v3, double *outNorm, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outNorm) {
    *outNorm = 0.0;
  }

  SpiceDouble v[3] = {0.0, 0.0, 0.0};
  if (v3) {
    v[0] = (SpiceDouble)v3[0];
    v[1] = (SpiceDouble)v3[1];
    v[2] = (SpiceDouble)v3[2];
  }

  const SpiceDouble norm = vnorm_c(v);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outNorm) {
    *outNorm = (double)norm;
  }

  return 0;
}

int tspice_vhat(const double *v3, double *outVhat3, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outVhat3) {
    outVhat3[0] = 0.0;
    outVhat3[1] = 0.0;
    outVhat3[2] = 0.0;
  }

  SpiceDouble v[3] = {0.0, 0.0, 0.0};
  if (v3) {
    v[0] = (SpiceDouble)v3[0];
    v[1] = (SpiceDouble)v3[1];
    v[2] = (SpiceDouble)v3[2];
  }

  // CSPICE's vhat_c signals an error on the zero vector.
  // For tspice, we keep parity with prior WASM TS behavior and treat a zero input
  // vector as success returning [0, 0, 0].
  if (v[0] == 0.0 && v[1] == 0.0 && v[2] == 0.0) {
    return 0;
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  vhat_c(v, out);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outVhat3) {
    outVhat3[0] = (double)out[0];
    outVhat3[1] = (double)out[1];
    outVhat3[2] = (double)out[2];
  }

  return 0;
}

int tspice_vdot(const double *a3, const double *b3, double *outDot, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outDot) {
    *outDot = 0.0;
  }

  SpiceDouble a[3] = {0.0, 0.0, 0.0};
  SpiceDouble b[3] = {0.0, 0.0, 0.0};
  if (a3) {
    a[0] = (SpiceDouble)a3[0];
    a[1] = (SpiceDouble)a3[1];
    a[2] = (SpiceDouble)a3[2];
  }
  if (b3) {
    b[0] = (SpiceDouble)b3[0];
    b[1] = (SpiceDouble)b3[1];
    b[2] = (SpiceDouble)b3[2];
  }

  const SpiceDouble dot = vdot_c(a, b);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outDot) {
    *outDot = (double)dot;
  }

  return 0;
}

int tspice_vcrss(
    const double *a3,
    const double *b3,
    double *outCross3,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble a[3] = {0.0, 0.0, 0.0};
  SpiceDouble b[3] = {0.0, 0.0, 0.0};
  if (a3) {
    a[0] = (SpiceDouble)a3[0];
    a[1] = (SpiceDouble)a3[1];
    a[2] = (SpiceDouble)a3[2];
  }
  if (b3) {
    b[0] = (SpiceDouble)b3[0];
    b[1] = (SpiceDouble)b3[1];
    b[2] = (SpiceDouble)b3[2];
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  vcrss_c(a, b, out);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outCross3) {
    outCross3[0] = (double)out[0];
    outCross3[1] = (double)out[1];
    outCross3[2] = (double)out[2];
  }

  return 0;
}

static void FillMat33(SpiceDouble out[3][3], const double *m3x3) {
  int i;
  int j;
  for (i = 0; i < 3; i++) {
    for (j = 0; j < 3; j++) {
      out[i][j] = 0.0;
    }
  }
  if (!m3x3) {
    return;
  }
  for (i = 0; i < 3; i++) {
    for (j = 0; j < 3; j++) {
      out[i][j] = (SpiceDouble)m3x3[i * 3 + j];
    }
  }
}

int tspice_mxv(const double *m3x3, const double *v3, double *outV3, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble m[3][3];
  FillMat33(m, m3x3);

  SpiceDouble v[3] = {0.0, 0.0, 0.0};
  if (v3) {
    v[0] = (SpiceDouble)v3[0];
    v[1] = (SpiceDouble)v3[1];
    v[2] = (SpiceDouble)v3[2];
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  mxv_c(m, v, out);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outV3) {
    outV3[0] = (double)out[0];
    outV3[1] = (double)out[1];
    outV3[2] = (double)out[2];
  }

  return 0;
}

int tspice_mtxv(const double *m3x3, const double *v3, double *outV3, char *err, int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }

  SpiceDouble m[3][3];
  FillMat33(m, m3x3);

  SpiceDouble v[3] = {0.0, 0.0, 0.0};
  if (v3) {
    v[0] = (SpiceDouble)v3[0];
    v[1] = (SpiceDouble)v3[1];
    v[2] = (SpiceDouble)v3[2];
  }

  SpiceDouble out[3] = {0.0, 0.0, 0.0};
  mtxv_c(m, v, out);
  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outV3) {
    outV3[0] = (double)out[0];
    outV3[1] = (double)out[1];
    outV3[2] = (double)out[2];
  }

  return 0;
}

int tspice_scs2e(
    int sc,
    const char *sclkch,
    double *outEt,
    char *err,
    int errMaxBytes) {
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
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (out && outMaxBytes > 0) {
    out[0] = '\0';
  }

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
    double *outMatrix3x3,
    double *outClkout,
    int *outFound,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }
  if (outClkout) {
    *outClkout = 0.0;
  }

  SpiceDouble cmat[3][3];
  SpiceDouble clkout = 0.0;
  SpiceBoolean found = SPICEFALSE;

  ckgp_c(
      (SpiceInt)inst,
      (SpiceDouble)sclkdp,
      (SpiceDouble)tol,
      ref,
      cmat,
      &clkout,
      &found);

  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = (found == SPICETRUE) ? 1 : 0;
  }

  if (found == SPICETRUE) {
    if (outMatrix3x3) {
      outMatrix3x3[0] = (double)cmat[0][0];
      outMatrix3x3[1] = (double)cmat[0][1];
      outMatrix3x3[2] = (double)cmat[0][2];
      outMatrix3x3[3] = (double)cmat[1][0];
      outMatrix3x3[4] = (double)cmat[1][1];
      outMatrix3x3[5] = (double)cmat[1][2];
      outMatrix3x3[6] = (double)cmat[2][0];
      outMatrix3x3[7] = (double)cmat[2][1];
      outMatrix3x3[8] = (double)cmat[2][2];
    }
    if (outClkout) {
      *outClkout = (double)clkout;
    }
  }

  return 0;
}

int tspice_ckgpav(
    int inst,
    double sclkdp,
    double tol,
    const char *ref,
    double *outMatrix3x3,
    double *outAv3,
    double *outClkout,
    int *outFound,
    char *err,
    int errMaxBytes) {
  InitCspiceErrorHandlingOnce();

  if (errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }
  if (outClkout) {
    *outClkout = 0.0;
  }
  if (outAv3) {
    outAv3[0] = 0.0;
    outAv3[1] = 0.0;
    outAv3[2] = 0.0;
  }

  SpiceDouble cmat[3][3];
  SpiceDouble av[3];
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
      &found);

  if (failed_c()) {
    GetSpiceErrorMessageAndReset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = (found == SPICETRUE) ? 1 : 0;
  }

  if (found == SPICETRUE) {
    if (outMatrix3x3) {
      outMatrix3x3[0] = (double)cmat[0][0];
      outMatrix3x3[1] = (double)cmat[0][1];
      outMatrix3x3[2] = (double)cmat[0][2];
      outMatrix3x3[3] = (double)cmat[1][0];
      outMatrix3x3[4] = (double)cmat[1][1];
      outMatrix3x3[5] = (double)cmat[1][2];
      outMatrix3x3[6] = (double)cmat[2][0];
      outMatrix3x3[7] = (double)cmat[2][1];
      outMatrix3x3[8] = (double)cmat[2][2];
    }
    if (outAv3) {
      outAv3[0] = (double)av[0];
      outAv3[1] = (double)av[1];
      outAv3[2] = (double)av[2];
    }
    if (outClkout) {
      *outClkout = (double)clkout;
    }
  }

  return 0;
}
