#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_temp_files.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_fixtures.h"
#include "cspice_runner_v2_spice_call.h"

bool v2_execute_spice_call_step(const char *json, const jsmntok_t *tokens,
                                       const int tokenCount, const int stepTok,
                                       const int argsTok, V2RefEntry *refs,
                                       int *refCount) {
  int callTok = jsmn_find_object_key(json, tokens, stepTok, "call", tokenCount);
  int inTok = jsmn_find_object_key(json, tokens, stepTok, "in", tokenCount);
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  if (callTok < 0 || tokens[callTok].type != JSMN_STRING || inTok < 0 ||
      tokens[inTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request",
                        "spiceCall requires string call and array in",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  char callDetail[256];
  callDetail[0] = '\0';
  char *callName = NULL;
  jsmn_strdup_err_t callErr =
      jsmn_strdup(json, &tokens[callTok], &callName, callDetail, sizeof(callDetail));
  if (callErr != JSMN_STRDUP_OK) {
    if (callErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          callDetail[0] ? callDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const int inputCount = tokens[inTok].size;

  if (strcmp(callName, "card_c") == 0 || strcmp(callName, "size_c") == 0) {
    if (inputCount != 1) {
      write_error_json_ex("invalid_request",
                          "spiceCall card_c/size_c expects one input",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "spiceCall card_c/size_c requires string as",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int inExprTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    int refIndex = -1;
    if (!v2_resolve_cell_or_window_ref(json,
                                       tokens,
                                       tokenCount,
                                       inExprTok,
                                       refs,
                                       *refCount,
                                       "spiceCall.in[0]",
                                       &refIndex)) {
      free(callName);
      return false;
    }

    SpiceInt out =
        (strcmp(callName, "card_c") == 0) ? card_c(&refs[refIndex].cell)
                                           : size_c(&refs[refIndex].cell);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      write_error_json_ex("spice_error", "SPICE error in spiceCall", callName,
                          shortMsg, longMsg, traceMsg);
      free(callName);
      return false;
    }

    char asDetail[256];
    asDetail[0] = '\0';
    char *asName = NULL;
    jsmn_strdup_err_t asErr =
        jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
    if (asErr != JSMN_STRDUP_OK) {
      if (asErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(callName);
      return false;
    }

    bool ok = v2_add_ref_int(refs, refCount, asName, out);
    free(asName);
    free(callName);
    return ok;
  }

  if (strcmp(callName, "dskgd_c") == 0 || strcmp(callName, "dskb02_c") == 0) {
    if (inputCount != 1) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskgd_c/dskb02_c expects one selector input",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskgd_c/dskb02_c requires string as",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int selectorTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    if (selectorTok < 0 || selectorTok >= tokenCount ||
        tokens[selectorTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args",
                          "spiceCall dskgd_c/dskb02_c selector must be a string",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char selectorDetail[256];
    selectorDetail[0] = '\0';
    char *selector = NULL;
    jsmn_strdup_err_t selectorErr = jsmn_strdup(json,
                                                &tokens[selectorTok],
                                                &selector,
                                                selectorDetail,
                                                sizeof(selectorDetail));
    if (selectorErr != JSMN_STRDUP_OK) {
      if (selectorErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            selectorDetail[0] ? selectorDetail : NULL, NULL,
                            NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(callName);
      return false;
    }

    bool selectorOk = false;
    if (strcmp(callName, "dskgd_c") == 0) {
      selectorOk = (strcmp(selector, "surfce") == 0 ||
                    strcmp(selector, "center") == 0);
    } else {
      selectorOk = (strcmp(selector, "nv") == 0 || strcmp(selector, "np") == 0);
    }

    if (!selectorOk) {
      write_error_json_ex("invalid_args",
                          "spiceCall selector is invalid for requested call",
                          selector,
                          NULL,
                          NULL,
                          NULL);
      free(selector);
      free(callName);
      return false;
    }

    char tempPath[PATH_MAX];
    if (!v2_write_minimal_dsk_file(
            strcmp(callName, "dskgd_c") == 0 ? "v2-dskgd" : "v2-dskb02",
            tempPath,
            sizeof(tempPath))) {
      free(selector);
      free(callName);
      return false;
    }

    SpiceInt handle = 0;
    dasopr_c(tempPath, &handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(selector);
      free(callName);
      write_error_json("SPICE error in dasopr", shortMsg, longMsg, traceMsg);
      return false;
    }

    SpiceDLADescr dladsc;
    SpiceBoolean found = SPICEFALSE;
    dlabfs_c(handle, &dladsc, &found);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      dascls_c(handle);
      unlink(tempPath);
      free(selector);
      free(callName);
      write_error_json("SPICE error in dlabfs", shortMsg, longMsg, traceMsg);
      return false;
    }

    if (found != SPICETRUE) {
      dascls_c(handle);
      unlink(tempPath);
      write_error_json_ex("invalid_request",
                          "spiceCall expected a DLA segment in minimal DSK",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      free(selector);
      free(callName);
      return false;
    }

    SpiceInt outValue = 0;

    if (strcmp(callName, "dskgd_c") == 0) {
      SpiceDSKDescr dskdsc;
      dskgd_c(handle, &dladsc, &dskdsc);
      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg,
                            sizeof(shortMsg),
                            longMsg,
                            sizeof(longMsg),
                            traceMsg,
                            sizeof(traceMsg));
        dascls_c(handle);
        unlink(tempPath);
        free(selector);
        free(callName);
        write_error_json("SPICE error in dskgd", shortMsg, longMsg, traceMsg);
        return false;
      }

      outValue = (strcmp(selector, "surfce") == 0) ? dskdsc.surfce : dskdsc.center;
    } else {
      SpiceInt nv = 0;
      SpiceInt np = 0;
      SpiceInt nvxtot = 0;
      SpiceDouble vtxbds[3][2];
      SpiceDouble voxsiz = 0.0;
      SpiceDouble voxori[3];
      SpiceInt vgrext[3];
      SpiceInt cgscal = 0;
      SpiceInt vtxnpl = 0;
      SpiceInt voxnpt = 0;
      SpiceInt voxnpl = 0;

      dskb02_c(handle,
               &dladsc,
               &nv,
               &np,
               &nvxtot,
               vtxbds,
               &voxsiz,
               voxori,
               vgrext,
               &cgscal,
               &vtxnpl,
               &voxnpt,
               &voxnpl);

      if (failed_c() == SPICETRUE) {
        char shortMsg[1841];
        char longMsg[1841];
        char traceMsg[1841];
        capture_spice_error(shortMsg,
                            sizeof(shortMsg),
                            longMsg,
                            sizeof(longMsg),
                            traceMsg,
                            sizeof(traceMsg));
        dascls_c(handle);
        unlink(tempPath);
        free(selector);
        free(callName);
        write_error_json("SPICE error in dskb02", shortMsg, longMsg, traceMsg);
        return false;
      }

      outValue = (strcmp(selector, "nv") == 0) ? nv : np;
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(selector);
      free(callName);
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      return false;
    }

    unlink(tempPath);

    char asDetail[256];
    asDetail[0] = '\0';
    char *asName = NULL;
    jsmn_strdup_err_t asErr =
        jsmn_strdup(json, &tokens[asTok], &asName, asDetail, sizeof(asDetail));
    if (asErr != JSMN_STRDUP_OK) {
      if (asErr == JSMN_STRDUP_INVALID) {
        write_error_json_ex("invalid_request", "Invalid JSON string escape",
                            asDetail[0] ? asDetail : NULL, NULL, NULL, NULL);
      } else {
        write_error_json("Out of memory", NULL, NULL, NULL);
      }
      free(selector);
      free(callName);
      return false;
    }

    bool ok = v2_add_ref_int(refs, refCount, asName, outValue);
    free(asName);
    free(selector);
    free(callName);
    return ok;
  }

  if (asTok >= 0) {
    write_error_json_ex("invalid_request",
                        "spiceCall scard_c/ssize_c/valid_c/dskobj_c/dsksrf_c/dskmi2_c/dskopn_c/dskw02_c/readVirtualOutput does not allow as",
                        NULL, NULL, NULL, NULL);
    free(callName);
    return false;
  }

  if (strcmp(callName, "scard_c") == 0) {
    if (inputCount != 2) {
      write_error_json_ex("invalid_request",
                          "spiceCall scard_c expects [card, cellOrWindow]",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int cardTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    SpiceInt card = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  cardTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(scard_c).in[0]",
                                  &card)) {
      free(callName);
      return false;
    }

    if (card < 0) {
      write_error_json_ex("invalid_args", "spiceCall(scard_c).in[0] must be >= 0",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int targetTok = jsmn_get_array_elem(tokens, inTok, 1, tokenCount);
    int refIndex = -1;
    if (!v2_resolve_cell_or_window_ref(json,
                                       tokens,
                                       tokenCount,
                                       targetTok,
                                       refs,
                                       *refCount,
                                       "spiceCall(scard_c).in[1]",
                                       &refIndex)) {
      free(callName);
      return false;
    }

    scard_c(card, &refs[refIndex].cell);
  } else if (strcmp(callName, "ssize_c") == 0) {
    if (inputCount != 2) {
      write_error_json_ex("invalid_request",
                          "spiceCall ssize_c expects [size, cellOrWindow]",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int sizeTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    SpiceInt newSize = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  sizeTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(ssize_c).in[0]",
                                  &newSize)) {
      free(callName);
      return false;
    }

    if (newSize < 0) {
      write_error_json_ex("invalid_args", "spiceCall(ssize_c).in[0] must be >= 0",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int targetTok = jsmn_get_array_elem(tokens, inTok, 1, tokenCount);
    int refIndex = -1;
    if (!v2_resolve_cell_or_window_ref(json,
                                       tokens,
                                       tokenCount,
                                       targetTok,
                                       refs,
                                       *refCount,
                                       "spiceCall(ssize_c).in[1]",
                                       &refIndex)) {
      free(callName);
      return false;
    }

    ssize_c(newSize, &refs[refIndex].cell);
  } else if (strcmp(callName, "valid_c") == 0) {
    if (inputCount != 3) {
      write_error_json_ex("invalid_request",
                          "spiceCall valid_c expects [size, n, cellOrWindow]",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int sizeTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
    int nTok = jsmn_get_array_elem(tokens, inTok, 1, tokenCount);
    SpiceInt sizeArg = 0;
    SpiceInt nArg = 0;
    if (!v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  sizeTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(valid_c).in[0]",
                                  &sizeArg) ||
        !v2_resolve_spiceint_expr(json,
                                  tokens,
                                  tokenCount,
                                  nTok,
                                  argsTok,
                                  refs,
                                  *refCount,
                                  "spiceCall(valid_c).in[1]",
                                  &nArg)) {
      free(callName);
      return false;
    }

    if (sizeArg < 0) {
      write_error_json_ex("invalid_args", "spiceCall(valid_c).in[0] must be >= 0",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }
    if (nArg < 0) {
      write_error_json_ex("invalid_args", "spiceCall(valid_c).in[1] must be >= 0",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    int targetTok = jsmn_get_array_elem(tokens, inTok, 2, tokenCount);
    int refIndex = -1;
    if (!v2_resolve_cell_or_window_ref(json,
                                       tokens,
                                       tokenCount,
                                       targetTok,
                                       refs,
                                       *refCount,
                                       "spiceCall(valid_c).in[2]",
                                       &refIndex)) {
      free(callName);
      return false;
    }

    valid_c(sizeArg, nArg, &refs[refIndex].cell);
  } else if (strcmp(callName, "dskopn_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskopn_c expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char detail[256];
    detail[0] = '\0';
    char tempPath[PATH_MAX];
    int tempFd = -1;
    if (!build_file_io_temp_path("v2-dskopn",
                                 ".bds",
                                 tempPath,
                                 sizeof(tempPath),
                                 &tempFd,
                                 detail,
                                 sizeof(detail))) {
      write_error_json_ex("invalid_request",
                          "Failed to create temporary DSK path",
                          detail[0] ? detail : NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    if (tempFd >= 0) {
      close(tempFd);
    }
    unlink(tempPath);

    SpiceInt handle = 0;
    dskopn_c(tempPath, "TSPICE", 0, &handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in dskopn", shortMsg, longMsg, traceMsg);
      return false;
    }

    dascls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
      return false;
    }

    unlink(tempPath);
    free(callName);
    return true;
  } else if (strcmp(callName, "dskmi2_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskmi2_c expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    if ((size_t)DSK_MINIMAL_WORKSZ > SIZE_MAX / sizeof(SpiceInt[2])) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(callName);
      return false;
    }

    SpiceInt(*work)[2] = (SpiceInt(*)[2])malloc(sizeof(SpiceInt[2]) *
                                                (size_t)DSK_MINIMAL_WORKSZ);
    if (work == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      free(callName);
      return false;
    }

    SpiceDouble spaixd[SPICE_DSK02_IXDFIX];
    SpiceInt spaixi[DSK_MINIMAL_SPXISZ];

    dskmi2_c((SpiceInt)DSK_MINIMAL_NV,
             (SpiceDouble(*)[3])DSK_MINIMAL_VERTICES,
             (SpiceInt)DSK_MINIMAL_NP,
             (SpiceInt(*)[3])DSK_MINIMAL_PLATES,
             0.2,
             5,
             (SpiceInt)DSK_MINIMAL_WORKSZ,
             (SpiceInt)DSK_MINIMAL_VOXPSZ,
             (SpiceInt)DSK_MINIMAL_VOXLSZ,
             SPICETRUE,
             (SpiceInt)DSK_MINIMAL_SPXISZ,
             work,
             spaixd,
             spaixi);

    free(work);

    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      free(callName);
      write_error_json("SPICE error in dskmi2", shortMsg, longMsg, traceMsg);
      return false;
    }

    free(callName);
    return true;
  } else if (strcmp(callName, "dskw02_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskw02_c expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char tempPath[PATH_MAX];
    if (!v2_write_minimal_dsk_file("v2-dskw02", tempPath, sizeof(tempPath))) {
      free(callName);
      return false;
    }

    unlink(tempPath);
    free(callName);
    return true;
  } else if (strcmp(callName, "dskobj_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall dskobj_c expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char tempPath[PATH_MAX];
    if (!v2_write_minimal_dsk_file("v2-dskobj", tempPath, sizeof(tempPath))) {
      free(callName);
      return false;
    }

    SPICEINT_CELL(bodids, 100);
    dskobj_c(tempPath, &bodids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in dskobj", shortMsg, longMsg, traceMsg);
      return false;
    }

    const SpiceInt bodyCount = card_c(&bodids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in card_c (dskobj)", shortMsg, longMsg,
                       traceMsg);
      return false;
    }

    if (bodyCount < 1) {
      unlink(tempPath);
      free(callName);
      write_error_json_ex("invalid_request",
                          "spiceCall(dskobj_c) expected at least one body id",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    unlink(tempPath);
    free(callName);
    return true;
  } else if (strcmp(callName, "dsksrf_c") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall dsksrf_c expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char tempPath[PATH_MAX];
    if (!v2_write_minimal_dsk_file("v2-dsksrf", tempPath, sizeof(tempPath))) {
      free(callName);
      return false;
    }

    SPICEINT_CELL(bodids, 100);
    SPICEINT_CELL(srfids, 100);

    dskobj_c(tempPath, &bodids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in dskobj (dsksrf setup)", shortMsg, longMsg,
                       traceMsg);
      return false;
    }

    const SpiceInt bodyCount = card_c(&bodids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in card_c (dsksrf body ids)", shortMsg,
                       longMsg, traceMsg);
      return false;
    }

    if (bodyCount < 1) {
      unlink(tempPath);
      free(callName);
      write_error_json_ex("invalid_request",
                          "spiceCall(dsksrf_c) expected at least one body id",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    const SpiceInt *bodyValues = (const SpiceInt *)bodids.data;
    const SpiceInt bodyid = bodyValues[0];

    dsksrf_c(tempPath, bodyid, &srfids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in dsksrf", shortMsg, longMsg, traceMsg);
      return false;
    }

    const SpiceInt surfaceCount = card_c(&srfids);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in card_c (dsksrf surface ids)", shortMsg,
                       longMsg, traceMsg);
      return false;
    }

    if (surfaceCount < 1) {
      unlink(tempPath);
      free(callName);
      write_error_json_ex("invalid_request",
                          "spiceCall(dsksrf_c) expected at least one surface id",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    unlink(tempPath);
    free(callName);
    return true;
  } else if (strcmp(callName, "readVirtualOutput") == 0) {
    if (inputCount != 0) {
      write_error_json_ex("invalid_request",
                          "spiceCall readVirtualOutput expects no inputs",
                          NULL, NULL, NULL, NULL);
      free(callName);
      return false;
    }

    char detail[256];
    detail[0] = '\0';
    char tempPath[PATH_MAX];
    int tempFd = -1;
    if (!build_file_io_temp_path("v2-read-virtual-output",
                                 ".bsp",
                                 tempPath,
                                 sizeof(tempPath),
                                 &tempFd,
                                 detail,
                                 sizeof(detail))) {
      write_error_json_ex("invalid_request",
                          "Failed to create temporary SPK path",
                          detail[0] ? detail : NULL,
                          NULL,
                          NULL,
                          NULL);
      free(callName);
      return false;
    }

    if (tempFd >= 0) {
      close(tempFd);
    }
    unlink(tempPath);

    SpiceInt handle = 0;
    spkopn_c(tempPath, "TSPICE", 0, &handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in spkopn", shortMsg, longMsg, traceMsg);
      return false;
    }

    spkw08_c(handle,
             1000,
             0,
             "J2000",
             0,
             60,
             "TSPICE_V2_READ_VO",
             1,
             2,
             READ_VIRTUAL_OUTPUT_STATES,
             0,
             60);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      spkcls_c(handle);
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in spkw08", shortMsg, longMsg, traceMsg);
      return false;
    }

    spkcls_c(handle);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      unlink(tempPath);
      free(callName);
      write_error_json("SPICE error in spkcls", shortMsg, longMsg, traceMsg);
      return false;
    }

    FILE *fp = fopen(tempPath, "rb");
    if (fp == NULL) {
      unlink(tempPath);
      free(callName);
      write_error_json_ex("invalid_request",
                          "readVirtualOutput could not open temporary output file",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    if (fseek(fp, 0, SEEK_END) != 0) {
      fclose(fp);
      unlink(tempPath);
      free(callName);
      write_error_json_ex("invalid_request",
                          "readVirtualOutput could not seek temporary output file",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    errno = 0;
    long fileBytes = ftell(fp);
    int ftellErrno = errno;
    fclose(fp);
    unlink(tempPath);

    if (fileBytes < 0) {
      char detail[256];
      if (ftellErrno != 0) {
        snprintf(detail, sizeof(detail), "ftell failed: %s", strerror(ftellErrno));
      } else {
        snprintf(detail, sizeof(detail), "ftell failed: unknown error");
      }

      free(callName);
      write_error_json_ex("invalid_request",
                          "readVirtualOutput could not determine temporary output file size",
                          detail,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    if (fileBytes == 0) {
      free(callName);
      write_error_json_ex("invalid_request",
                          "readVirtualOutput expected non-empty output bytes",
                          NULL,
                          NULL,
                          NULL,
                          NULL);
      return false;
    }

    free(callName);
    return true;
  } else {
    write_error_json_ex("unsupported_call", "Unsupported v2 spiceCall", callName,
                        NULL, NULL, NULL);
    free(callName);
    return false;
  }

  if (failed_c() == SPICETRUE) {
    char shortMsg[1841];
    char longMsg[1841];
    char traceMsg[1841];
    capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                        traceMsg, sizeof(traceMsg));
    write_error_json_ex("spice_error", "SPICE error in spiceCall", callName,
                        shortMsg, longMsg, traceMsg);
    free(callName);
    return false;
  }

  free(callName);
  return true;
}