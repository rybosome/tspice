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
