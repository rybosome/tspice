#include "tspice_backend_shim.h"

#include "SpiceUsr.h"

#include <limits.h>
#include <stddef.h>
#include <string.h>

static int tspice_kernel_pool_invalid_arg(char *err, int errMaxBytes, const char *msg) {
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

static int tspice_is_empty_or_ascii_whitespace_only(const char *s) {
  if (!s || s[0] == '\0') {
    return 1;
  }

  // ASCII whitespace: space, tab, newline, carriage return, formfeed, vertical tab.
  for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
    const unsigned char c = *p;
    const int isWs = (c == ' ') || (c == '\t') || (c == '\n') || (c == '\r') || (c == '\f') || (c == '\v');
    if (!isWs) {
      return 0;
    }
  }

  return 1;
}

static int finish_pool_call(char *err, int errMaxBytes) {
  if (!failed_c()) return 0;
  tspice_get_spice_error_message_and_reset(err, errMaxBytes);
  return 1;
}

// ZZBODKER builds the ID hash from paired name/code mappings. N0067
// ZZHASHI takes signed abs(code), which has no representation for INT_MIN.
static int check_body_mapping_codes(char *err, int errMaxBytes) {
  SpiceBoolean found = SPICEFALSE;
  SpiceInt names = 0, codes = 0;
  SpiceChar type[2] = {0};
  dtpool_c("NAIF_BODY_NAME", &found, &names, type);
  if (failed_c()) return finish_pool_call(err, errMaxBytes);
  if (!found || type[0] != 'C' || names > 14983) return 0;
  dtpool_c("NAIF_BODY_CODE", &found, &codes, type);
  if (failed_c()) return finish_pool_call(err, errMaxBytes);
  if (!found || type[0] != 'N' || names != codes) return 0;
  int unsafe = 0;
  for (SpiceInt start = 0; start < codes; start += 64) {
    SpiceDouble values[64];
    SpiceInt used = 0;
    gdpool_c("NAIF_BODY_CODE", start, 64, &used, values, &found);
    if (failed_c()) return finish_pool_call(err, errMaxBytes);
    for (SpiceInt i = 0; i < used; ++i) {
      // GIPOOL validates and rounds all codes before any hashes are built.
      // Let it report its own conversion error, including in a mixed table.
      if (!(values[i] >= (double)INT_MIN && values[i] <= (double)INT_MAX)) return 0;
      if (values[i] <= (double)INT_MIN + 0.5) unsafe = 1;
    }
  }
  if (!unsafe) return 0;
  // ZZBODKER also diagnoses blank names (in a 36-byte record) before
  // entering ZZBODINI. Preserve that ordinary error and its traceback.
  for (SpiceInt start = 0; start < names; start += 64) {
    SpiceChar rows[64][37];
    SpiceInt used = 0;
    gcpool_c("NAIF_BODY_NAME", start, 64, 37, &used, rows, &found);
    if (failed_c()) return finish_pool_call(err, errMaxBytes);
    for (SpiceInt i = 0; i < used; ++i) {
      if (!rows[i][0]) return 0;
    }
  }
  return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "NAIF_BODY_CODE outside the safe N0067 body hash range");
}

// STPOOL's translated loop compares from one byte before the component
// when its last significant byte is one position before the marker length.
// Inspect only components visited for this logical string. Let stpool_c do
// all concatenation, truncation, indexing and found/size reporting.
static int check_stpool_components(const char *item, int nth, const char *contin,
                                   int lenout, char *err, int errMaxBytes) {
  if (!*item || !*contin || nth < 0 || lenout < 2) return 0;
  size_t marker = strlen(contin);
  while (marker > 1 && contin[marker - 1] == ' ') --marker;
  if (marker < 2 || marker > 81) return 0;
  SpiceInt logical = 0;
  for (SpiceInt start = 0; start < TSPICE_POOL_MAX_CHAR_ROWS; start += 32) {
    SpiceChar rows[32][81] = {{0}};
    SpiceInt used = 0;
    SpiceBoolean found = SPICEFALSE;
    gcpool_c(item, start, 32, 81, &used, rows, &found);
    if (failed_c()) return finish_pool_call(err, errMaxBytes);
    if (!found || !used) return 0;
    for (SpiceInt i = 0; i < used; ++i) {
      // GCPool removes trailing blanks. RTRIM in STPOOL gives a blank row length one.
      const size_t bytes = strlen(rows[i]);
      const size_t last = bytes ? bytes : 1;
      if (marker == last + 1)
        return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "Unsafe N0067 STPOOL continuation marker/component byte lengths");
      if (last < marker || memcmp(rows[i] + last - marker, contin, marker) != 0) {
        if (logical == nth) return 0;
        ++logical;
      }
    }
    if (used < 32) return 0;
  }
  return 0;
}

int tspice_badkpv(const char *caller, const char *name, const char *comp, int size, int divby, int type, int *bad, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!caller || !name || !comp || !bad || type < 0 || type > 127) return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "Invalid badkpv storage or dimensions");
  *bad = badkpv_c(caller, name, comp, size, divby, (SpiceChar)type);
  return finish_pool_call(err, errMaxBytes);
}

int tspice_bodvcd(int body, const char *item, int maxn, int *dim, double *values, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!item || !dim || !values) return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "Invalid bodvcd storage or dimensions");
  if (maxn > TSPICE_POOL_MAX_VALUES) maxn = TSPICE_POOL_MAX_VALUES;
  bodvcd_c(body, item, maxn, dim, values);
  return finish_pool_call(err, errMaxBytes);
}

int tspice_bodvrd(const char *body, const char *item, int maxn, int *dim, double *values, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!body || !item || !dim || !values) return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "Invalid bodvrd storage or dimensions");
  if (*body && *item && check_body_mapping_codes(err, errMaxBytes)) return 1;
  if (maxn > TSPICE_POOL_MAX_VALUES) maxn = TSPICE_POOL_MAX_VALUES;
  bodvrd_c(body, item, maxn, dim, values);
  return finish_pool_call(err, errMaxBytes);
}

int tspice_clpool(char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  clpool_c();
  return finish_pool_call(err, errMaxBytes);
}

int tspice_dvpool(const char *name, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!name) return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "Invalid dvpool storage or dimensions");
  dvpool_c(name);
  return finish_pool_call(err, errMaxBytes);
}

int tspice_ldpool(const char *path, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!path) return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "Invalid ldpool storage or dimensions");
  ldpool_c(path);
  return finish_pool_call(err, errMaxBytes);
}

int tspice_lmpool(const char *rows, int stride, int count, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!rows || count < 0 || stride < 2 || count > INT_MAX / stride) return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "Invalid lmpool storage or dimensions");
  for (int i = 0; i < count; ++i) {
    if (!memchr(rows + (size_t)i * stride, 0, (size_t)stride))
      return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "Unterminated lmpool row");
  }
  lmpool_c(rows, stride, count);
  return finish_pool_call(err, errMaxBytes);
}

int tspice_stpool(const char *item, int nth, const char *contin, int lenout, char *text, int *size, int *found, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  // The public C adapter reads its local Fortran found output after return.
  if (failed_c()) return finish_pool_call(err, errMaxBytes);
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!item || !contin || !text || !size || !found) return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "Invalid stpool storage or dimensions");
  // stpool_c adds one to nth. Both large values necessarily miss.
  if (nth == INT_MAX) --nth;
  if (lenout > TSPICE_POOL_TEXT_CAPACITY) lenout = TSPICE_POOL_TEXT_CAPACITY;
  if (check_stpool_components(item, nth, contin, lenout, err, errMaxBytes)) return 1;
  stpool_c(item, nth, contin, lenout, text, size, found);
  return finish_pool_call(err, errMaxBytes);
}

int tspice_szpool(const char *name, int *n, int *found, char *err, int errMaxBytes) {
  tspice_init_cspice_error_handling_once();
  // The public C adapter reads its local Fortran found output after return.
  if (failed_c()) return finish_pool_call(err, errMaxBytes);
  if (err && errMaxBytes > 0) err[0] = 0;
  if (!name || !n || !found) return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "Invalid szpool storage or dimensions");
  szpool_c(name, n, found);
  return finish_pool_call(err, errMaxBytes);
}

int tspice_gdpool(
    const char *name,
    int start,
    int room,
    int *outN,
    double *outValues,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outN) {
    *outN = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gdpool(): name must not be NULL");
  }
  if (start < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gdpool(): start must be >= 0");
  }
  if (room <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gdpool(): room must be > 0");
  }
  if (room > 0 && !outValues) {
    return tspice_kernel_pool_invalid_arg(
        err,
        errMaxBytes,
        "tspice_gdpool(): outValues must not be NULL when room > 0");
  }

  SpiceInt nC = 0;
  SpiceBoolean foundC = SPICEFALSE;

  gdpool_c(name, (SpiceInt)start, (SpiceInt)room, &nC, (SpiceDouble *)outValues, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outN) {
    *outN = (int)nC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_gipool(
    const char *name,
    int start,
    int room,
    int *outN,
    int *outValues,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outN) {
    *outN = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gipool(): name must not be NULL");
  }
  if (start < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gipool(): start must be >= 0");
  }
  if (room <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gipool(): room must be > 0");
  }
  if (room > 0 && !outValues) {
    return tspice_kernel_pool_invalid_arg(
        err,
        errMaxBytes,
        "tspice_gipool(): outValues must not be NULL when room > 0");
  }

  SpiceInt nC = 0;
  SpiceBoolean foundC = SPICEFALSE;

  gipool_c(name, (SpiceInt)start, (SpiceInt)room, &nC, (SpiceInt *)outValues, &foundC);
  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outN) {
    *outN = (int)nC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_gcpool(
    const char *name,
    int start,
    int room,
    int cvalen,
    int *outN,
    void *outCvals,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outN) {
    *outN = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gcpool(): name must not be NULL");
  }
  if (start < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gcpool(): start must be >= 0");
  }
  if (room <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gcpool(): room must be > 0");
  }
  if (cvalen <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gcpool(): cvalen must be > 0");
  }
  if (room > 0 && !outCvals) {
    return tspice_kernel_pool_invalid_arg(
        err,
        errMaxBytes,
        "tspice_gcpool(): outCvals must not be NULL when room > 0");
  }

  SpiceInt nC = 0;
  SpiceBoolean foundC = SPICEFALSE;

  gcpool_c(
      name,
      (SpiceInt)start,
      (SpiceInt)room,
      (SpiceInt)cvalen,
      &nC,
      outCvals,
      &foundC);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outN) {
    *outN = (int)nC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_gnpool(
    const char *name,
    int start,
    int room,
    int cvalen,
    int *outN,
    void *outCvals,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outN) {
    *outN = 0;
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gnpool(): name must not be NULL");
  }

  if (tspice_is_empty_or_ascii_whitespace_only(name)) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gnpool(): name must be a non-empty string");
  }
  if (start < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gnpool(): start must be >= 0");
  }
  if (room <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gnpool(): room must be > 0");
  }
  if (cvalen <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_gnpool(): cvalen must be > 0");
  }
  if (room > 0 && !outCvals) {
    return tspice_kernel_pool_invalid_arg(
        err,
        errMaxBytes,
        "tspice_gnpool(): outCvals must not be NULL when room > 0");
  }

  SpiceInt nC = 0;
  SpiceBoolean foundC = SPICEFALSE;

  gnpool_c(
      name,
      (SpiceInt)start,
      (SpiceInt)room,
      (SpiceInt)cvalen,
      &nC,
      outCvals,
      &foundC);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outN) {
    *outN = (int)nC;
  }
  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_dtpool(
    const char *name,
    int *outFound,
    int *outN,
    char *outType,
    int outTypeMaxBytes,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }
  if (outN) {
    *outN = 0;
  }
  if (outType && outTypeMaxBytes > 0) {
    outType[0] = 'X';
    if (outTypeMaxBytes > 1) {
      outType[1] = '\0';
    }
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_dtpool(): name must not be NULL");
  }

  SpiceBoolean foundC = SPICEFALSE;
  SpiceInt nC = 0;
  SpiceChar typeC[2];
  typeC[0] = 'X';
  typeC[1] = '\0';

  dtpool_c(name, &foundC, &nC, typeC);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }
  if (outN) {
    *outN = (int)nC;
  }

  if (outType && outTypeMaxBytes > 0) {
    outType[0] = typeC[0];
    if (outTypeMaxBytes > 1) {
      outType[1] = '\0';
    }
  }

  return 0;
}

int tspice_pdpool(
    const char *name,
    int n,
    const double *values,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pdpool(): name must not be NULL");
  }
  if (n < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pdpool(): n must be >= 0");
  }
  if (n > 0 && !values) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pdpool(): values must not be NULL when n > 0");
  }

  pdpool_c(name, (SpiceInt)n, (ConstSpiceDouble *)values);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_pipool(
    const char *name,
    int n,
    const int *ivals,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pipool(): name must not be NULL");
  }
  if (n < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pipool(): n must be >= 0");
  }
  if (n > 0 && !ivals) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pipool(): ivals must not be NULL when n > 0");
  }

  pipool_c(name, (SpiceInt)n, (ConstSpiceInt *)ivals);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_pcpool(
    const char *name,
    int n,
    int lenvals,
    const void *cvals,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pcpool(): name must not be NULL");
  }
  if (n < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pcpool(): n must be >= 0");
  }
  if (lenvals <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pcpool(): lenvals must be > 0");
  }
  if (n > 0 && !cvals) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_pcpool(): cvals must not be NULL when n > 0");
  }

  pcpool_c(name, (SpiceInt)n, (SpiceInt)lenvals, cvals);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_swpool(
    const char *agent,
    int nnames,
    int namlen,
    const void *names,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }

  if (!agent) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_swpool(): agent must not be NULL");
  }
  if (nnames < 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_swpool(): nnames must be >= 0");
  }
  if (namlen <= 0) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_swpool(): namlen must be > 0");
  }
  if (nnames > 0 && !names) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_swpool(): names must not be NULL when nnames > 0");
  }

  // CSPICE rejects a NULL `names` pointer even when nnames==0.
  // Preserve the existing ABI semantics (empty list allowed) by
  // substituting a dummy non-null pointer in that case.
  const void *namesArg = names;
  char dummyNames[1];
  if (nnames == 0 && names == NULL) {
    dummyNames[0] = '\0';
    namesArg = dummyNames;
  }

  swpool_c(agent, (SpiceInt)nnames, (SpiceInt)namlen, namesArg);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  return 0;
}

int tspice_cvpool(
    const char *agent,
    int *outUpdate,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outUpdate) {
    *outUpdate = 0;
  }

  if (!agent) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_cvpool(): agent must not be NULL");
  }

  SpiceBoolean updateC = SPICEFALSE;
  cvpool_c(agent, &updateC);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outUpdate) {
    *outUpdate = updateC == SPICETRUE ? 1 : 0;
  }

  return 0;
}

int tspice_expool(
    const char *name,
    int *outFound,
    char *err,
    int errMaxBytes) {
  tspice_init_cspice_error_handling_once();

  if (errMaxBytes > 0 && err) {
    err[0] = '\0';
  }
  if (outFound) {
    *outFound = 0;
  }

  if (!name) {
    return tspice_kernel_pool_invalid_arg(err, errMaxBytes, "tspice_expool(): name must not be NULL");
  }

  SpiceBoolean foundC = SPICEFALSE;
  expool_c(name, &foundC);

  if (failed_c()) {
    tspice_get_spice_error_message_and_reset(err, errMaxBytes);
    return 1;
  }

  if (outFound) {
    *outFound = foundC == SPICETRUE ? 1 : 0;
  }

  return 0;
}
