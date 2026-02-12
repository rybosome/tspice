#include "tspice_backend_shim.h"

#include "SpiceUsr.h"
#include "SpiceEK.h"

#include <stddef.h>
#include <stdlib.h>
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
  const SpiceInt nsegC = eknseg_c((SpiceInt)handle);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }
  if (nsegC < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_eknseg: expected a non-negative segment count");
  }

  *outNseg = (int)nsegC;
  return 0;
}


// --- EK query/data ops -----------------------------------------------------

int tspice_ekfind(
    const char *query,
    int outErrmsgMaxBytes,
    int *outNmrows,
    int *outError,
    char *outErrmsg,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outNmrows) {
    *outNmrows = 0;
  }
  if (outError) {
    *outError = 0;
  }
  if (outErrmsg && outErrmsgMaxBytes > 0) {
    outErrmsg[0] = '\0';
  }

  if (!query || query[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekfind: query must be a non-empty string");
  }
  if (!outNmrows) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekfind: outNmrows must be non-NULL");
  }
  if (!outError) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekfind: outError must be non-NULL");
  }
  if (!outErrmsg) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekfind: outErrmsg must be non-NULL");
  }
  if (outErrmsgMaxBytes < 2) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekfind: outErrmsgMaxBytes must be >= 2");
  }

  SpiceInt nmrowsC = 0;
  SpiceBoolean errorC = SPICEFALSE;
  ekfind_c(query, (SpiceInt)outErrmsgMaxBytes, &nmrowsC, &errorC, outErrmsg);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  // Ensure stable NUL-termination even if code changes.
  outErrmsg[outErrmsgMaxBytes - 1] = '\0';

  *outError = errorC == SPICETRUE ? 1 : 0;
  *outNmrows = (errorC == SPICETRUE) ? 0 : (int)nmrowsC;
  return 0;
}

int tspice_ekgc(
    int selidx,
    int row,
    int elment,
    char *outCdata,
    int outCdataMaxBytes,
    int *outNull,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outCdata && outCdataMaxBytes > 0) {
    outCdata[0] = '\0';
  }
  if (outNull) {
    *outNull = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!outCdata) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: outCdata must be non-NULL");
  }
  if (outCdataMaxBytes < 2) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: outCdataMaxBytes must be >= 2");
  }
  if (!outNull) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: outNull must be non-NULL");
  }
  if (!outFound) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: outFound must be non-NULL");
  }
  if (selidx < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: selidx must be >= 0");
  }
  if (row < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: row must be >= 0");
  }
  if (elment < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgc: elment must be >= 0");
  }

  SpiceBoolean nullC = SPICEFALSE;
  SpiceBoolean foundC = SPICEFALSE;
  ekgc_c(
      (SpiceInt)selidx,
      (SpiceInt)row,
      (SpiceInt)elment,
      (SpiceInt)outCdataMaxBytes,
      outCdata,
      &nullC,
      &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  // Ensure stable NUL-termination even if code changes.
  outCdata[outCdataMaxBytes - 1] = '\0';

  *outNull = nullC == SPICETRUE ? 1 : 0;
  *outFound = foundC == SPICETRUE ? 1 : 0;
  return 0;
}

int tspice_ekgd(
    int selidx,
    int row,
    int elment,
    double *outDdata,
    int *outNull,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outDdata) {
    *outDdata = 0;
  }
  if (outNull) {
    *outNull = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!outDdata) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: outDdata must be non-NULL");
  }
  if (!outNull) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: outNull must be non-NULL");
  }
  if (!outFound) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: outFound must be non-NULL");
  }
  if (selidx < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: selidx must be >= 0");
  }
  if (row < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: row must be >= 0");
  }
  if (elment < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgd: elment must be >= 0");
  }

  SpiceBoolean nullC = SPICEFALSE;
  SpiceBoolean foundC = SPICEFALSE;
  SpiceDouble ddataC = 0;
  ekgd_c((SpiceInt)selidx, (SpiceInt)row, (SpiceInt)elment, &ddataC, &nullC, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outDdata = (double)ddataC;
  *outNull = nullC == SPICETRUE ? 1 : 0;
  *outFound = foundC == SPICETRUE ? 1 : 0;
  return 0;
}

int tspice_ekgi(
    int selidx,
    int row,
    int elment,
    int *outIdata,
    int *outNull,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outIdata) {
    *outIdata = 0;
  }
  if (outNull) {
    *outNull = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!outIdata) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: outIdata must be non-NULL");
  }
  if (!outNull) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: outNull must be non-NULL");
  }
  if (!outFound) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: outFound must be non-NULL");
  }
  if (selidx < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: selidx must be >= 0");
  }
  if (row < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: row must be >= 0");
  }
  if (elment < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekgi: elment must be >= 0");
  }

  SpiceBoolean nullC = SPICEFALSE;
  SpiceBoolean foundC = SPICEFALSE;
  SpiceInt idataC = 0;
  ekgi_c((SpiceInt)selidx, (SpiceInt)row, (SpiceInt)elment, &idataC, &nullC, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outIdata = (int)idataC;
  *outNull = nullC == SPICETRUE ? 1 : 0;
  *outFound = foundC == SPICETRUE ? 1 : 0;
  return 0;
}


// --- EK fast write ---------------------------------------------------------

static int tspice_ek_sum_entszs(
    int nrows,
    const int *entszs,
    const int *nlflgs,
    int *outSum,
    char *err,
    int errMaxBytes) {
  if (!outSum) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: outSum must be non-NULL");
  }
  *outSum = 0;

  if (nrows <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: nrows must be > 0");
  }
  if (!entszs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: entszs must be non-NULL");
  }
  if (!nlflgs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: nlflgs must be non-NULL");
  }

  long long sum = 0;
  for (int i = 0; i < nrows; i++) {
    const int sz = entszs[i];
    const int isNull = nlflgs[i];

    if (isNull != 0 && isNull != 1) {
      return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: nlflgs must contain only 0/1");
    }
    // CSPICE semantics:
    // - nlflgs[i] indicates whether the row entry is NULL.
    // - For NULL entries, entszs[i] may be 0 (and is allowed to be any value >= 0).
    // - For non-NULL entries, entszs[i] must be >= 1.
    if (isNull == 1) {
      if (sz < 0) {
        return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: NULL entries must have entszs[i] >= 0");
      }
    } else {
      if (sz < 1) {
        return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: non-NULL entries must have entszs[i] >= 1");
      }
    }

    sum += (long long)sz;
    if (sum > 2147483647LL) {
      return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ek_sum_entszs: total value count overflow");
    }
  }

  *outSum = (int)sum;
  return 0;
}

int tspice_ekifld(
    int handle,
    const char *tabnam,
    int ncols,
    int nrows,
    int cnamln,
    const char *cnames,
    int declen,
    const char *decls,
    int *outSegno,
    int *outRcptrs,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }
  if (outSegno) {
    *outSegno = 0;
  }
  if (outRcptrs && nrows > 0) {
    // Best-effort init.
    for (int i = 0; i < nrows; i++) {
      outRcptrs[i] = 0;
    }
  }

  if (!tabnam || tabnam[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: tabnam must be a non-empty string");
  }
  if (ncols <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: ncols must be > 0");
  }
  if (nrows <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: nrows must be > 0");
  }
  if (!cnames) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: cnames must be non-NULL");
  }
  if (!decls) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: decls must be non-NULL");
  }
  if (cnamln < 2) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: cnamln must be >= 2");
  }
  if (declen < 2) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: declen must be >= 2");
  }
  if (!outSegno) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: outSegno must be non-NULL");
  }
  if (!outRcptrs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekifld: outRcptrs must be non-NULL");
  }

  SpiceInt segnoC = 0;
  ekifld_c(
      (SpiceInt)handle,
      tabnam,
      (SpiceInt)ncols,
      (SpiceInt)nrows,
      (SpiceInt)cnamln,
      (const void *)cnames,
      (SpiceInt)declen,
      (const void *)decls,
      &segnoC,
      (SpiceInt *)outRcptrs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  *outSegno = (int)segnoC;
  return 0;
}

int tspice_ekacli(
    int handle,
    int segno,
    const char *column,
    int nrows,
    const int *ivals,
    int nvals,
    const int *entszs,
    const int *nlflgs,
    int *rcptrs,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (segno < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: segno must be >= 0");
  }
  if (!column || column[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: column must be a non-empty string");
  }
  if (nrows <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: nrows must be > 0");
  }
  if (!entszs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: entszs must be non-NULL");
  }
  if (!nlflgs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: nlflgs must be non-NULL");
  }
  if (!rcptrs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: rcptrs must be non-NULL");
  }
  if (nvals < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: nvals must be >= 0");
  }
  if (nvals > 0 && !ivals) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: ivals must be non-NULL when nvals > 0");
  }

  int required = 0;
  const int sumCode = tspice_ek_sum_entszs(nrows, entszs, nlflgs, &required, err, errMaxBytes);
  if (sumCode != 0) {
    return 1;
  }
  if (nvals != required) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: nvals must match sum(entszs)");
  }

  SpiceInt *wkindx = (SpiceInt *)malloc((size_t)nrows * sizeof(SpiceInt));
  if (!wkindx) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacli: failed to allocate wkindx workspace");
  }
  memset(wkindx, 0, (size_t)nrows * sizeof(SpiceInt));

  ekacli_c(
      (SpiceInt)handle,
      (SpiceInt)segno,
      column,
      (const SpiceInt *)ivals,
      (const SpiceInt *)entszs,
      (const SpiceBoolean *)nlflgs,
      (const SpiceInt *)rcptrs,
      wkindx);

  free(wkindx);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_ekacld(
    int handle,
    int segno,
    const char *column,
    int nrows,
    const double *dvals,
    int nvals,
    const int *entszs,
    const int *nlflgs,
    int *rcptrs,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (segno < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: segno must be >= 0");
  }
  if (!column || column[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: column must be a non-empty string");
  }
  if (nrows <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: nrows must be > 0");
  }
  if (!entszs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: entszs must be non-NULL");
  }
  if (!nlflgs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: nlflgs must be non-NULL");
  }
  if (!rcptrs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: rcptrs must be non-NULL");
  }
  if (nvals < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: nvals must be >= 0");
  }
  if (nvals > 0 && !dvals) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: dvals must be non-NULL when nvals > 0");
  }

  int required = 0;
  const int sumCode = tspice_ek_sum_entszs(nrows, entszs, nlflgs, &required, err, errMaxBytes);
  if (sumCode != 0) {
    return 1;
  }
  if (nvals != required) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: nvals must match sum(entszs)");
  }

  SpiceInt *wkindx = (SpiceInt *)malloc((size_t)nrows * sizeof(SpiceInt));
  if (!wkindx) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekacld: failed to allocate wkindx workspace");
  }
  memset(wkindx, 0, (size_t)nrows * sizeof(SpiceInt));

  ekacld_c(
      (SpiceInt)handle,
      (SpiceInt)segno,
      column,
      (const SpiceDouble *)dvals,
      (const SpiceInt *)entszs,
      (const SpiceBoolean *)nlflgs,
      (const SpiceInt *)rcptrs,
      wkindx);

  free(wkindx);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_ekaclc(
    int handle,
    int segno,
    const char *column,
    int nrows,
    int nvals,
    int vallen,
    int cvalsMaxBytes,
    const char *cvals,
    const int *entszs,
    const int *nlflgs,
    int *rcptrs,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (segno < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: segno must be >= 0");
  }
  if (!column || column[0] == '\0') {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: column must be a non-empty string");
  }
  if (nrows <= 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: nrows must be > 0");
  }
  if (!entszs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: entszs must be non-NULL");
  }
  if (!nlflgs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: nlflgs must be non-NULL");
  }
  if (!rcptrs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: rcptrs must be non-NULL");
  }
  if (nvals < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: nvals must be >= 0");
  }
  if (nvals > 0 && !cvals) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: cvals must be non-NULL when nvals > 0");
  }
  if (vallen < 1) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: vallen must be > 0");
  }
  if (cvalsMaxBytes < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: cvalsMaxBytes must be >= 0");
  }

  int required = 0;
  const int sumCode = tspice_ek_sum_entszs(nrows, entszs, nlflgs, &required, err, errMaxBytes);
  if (sumCode != 0) {
    return 1;
  }
  if (nvals != required) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: nvals must match sum(entszs)");
  }

  // Ensure the caller-provided `cvals` buffer is large enough to safely read
  // `nvals` fixed-width strings (each of width `vallen`).
  const long long requiredBytes = (long long)nvals * (long long)vallen;
  if (requiredBytes < 0 || requiredBytes > 2147483647LL) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: cvals byte size overflow");
  }
  if ((long long)cvalsMaxBytes < requiredBytes) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: cvalsMaxBytes must be >= nvals*vallen");
  }

  SpiceInt *wkindx = (SpiceInt *)malloc((size_t)nrows * sizeof(SpiceInt));
  if (!wkindx) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekaclc: failed to allocate wkindx workspace");
  }
  memset(wkindx, 0, (size_t)nrows * sizeof(SpiceInt));

  ekaclc_c(
      (SpiceInt)handle,
      (SpiceInt)segno,
      column,
      (SpiceInt)vallen,
      (const void *)cvals,
      (const SpiceInt *)entszs,
      (const SpiceBoolean *)nlflgs,
      (const SpiceInt *)rcptrs,
      wkindx);

  free(wkindx);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_ekffld(int handle, int segno, int *rcptrs, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (err && errMaxBytes > 0) {
    err[0] = '\0';
  }

  if (segno < 0) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekffld: segno must be >= 0");
  }
  if (!rcptrs) {
    return tspice_ek_invalid_arg(err, errMaxBytes, "tspice_ekffld: rcptrs must be non-NULL");
  }

  ekffld_c((SpiceInt)handle, (SpiceInt)segno, (SpiceInt *)rcptrs);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}
