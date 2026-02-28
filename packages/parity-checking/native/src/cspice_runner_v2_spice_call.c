#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_temp_files.h"
#include "cspice_runner_v2_call_spec.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_fixtures.h"
#include "cspice_runner_v2_spice_call.h"

#include <limits.h>

typedef struct {
  SpiceInt intArgs[V2_SPICE_CALL_MAX_ARGS];
  int cellOrWindowRefIndices[V2_SPICE_CALL_MAX_ARGS];
} V2SimpleSpiceCallArgs;

static void v2_init_simple_spice_call_args(V2SimpleSpiceCallArgs *args) {
  for (int i = 0; i < V2_SPICE_CALL_MAX_ARGS; i++) {
    args->intArgs[i] = 0;
    args->cellOrWindowRefIndices[i] = -1;
  }
}

static void v2_format_simple_arg_label(const char *callName,
                                       int argIndex,
                                       char *buffer,
                                       size_t bufferSize) {
  if (bufferSize == 0) {
    return;
  }

  snprintf(buffer, bufferSize, "spiceCall(%s).in[%d]", callName, argIndex);
}

static bool v2_resolve_simple_spice_call_args(const char *json,
                                              const jsmntok_t *tokens,
                                              int tokenCount,
                                              int inTok,
                                              int argsTok,
                                              V2RefEntry *refs,
                                              int refCount,
                                              const V2SpiceCallSpec *callSpec,
                                              const char *callName,
                                              V2SimpleSpiceCallArgs *outArgs) {
  v2_init_simple_spice_call_args(outArgs);
  const unsigned int nonNegativeMaskWidth =
      (unsigned int)(sizeof(callSpec->nonNegativeIntArgMask) * CHAR_BIT);

  for (int argIndex = 0; argIndex < callSpec->arity; argIndex++) {
    int argTok = jsmn_get_array_elem(tokens, inTok, argIndex, tokenCount);
    char label[96];
    v2_format_simple_arg_label(callName, argIndex, label, sizeof(label));

    if (callSpec->argKinds[argIndex] == V2_SPICE_CALL_ARG_INT_EXPR) {
      if (!v2_resolve_spiceint_expr(json,
                                    tokens,
                                    tokenCount,
                                    argTok,
                                    argsTok,
                                    refs,
                                    refCount,
                                    label,
                                    &outArgs->intArgs[argIndex])) {
        return false;
      }

      if ((unsigned int)argIndex < nonNegativeMaskWidth &&
          (callSpec->nonNegativeIntArgMask & (1u << (unsigned int)argIndex)) !=
              0u &&
          outArgs->intArgs[argIndex] < 0) {
        char message[128];
        snprintf(message, sizeof(message), "%s must be >= 0", label);
        write_error_json_ex("invalid_args", message, NULL, NULL, NULL, NULL);
        return false;
      }

      continue;
    }

    if (callSpec->argKinds[argIndex] == V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF) {
      int refIndex = -1;
      if (!v2_resolve_cell_or_window_ref(json,
                                         tokens,
                                         tokenCount,
                                         argTok,
                                         refs,
                                         refCount,
                                         label,
                                         &refIndex)) {
        return false;
      }

      outArgs->cellOrWindowRefIndices[argIndex] = refIndex;
      continue;
    }

    write_error_json_ex("invalid_request",
                        "Unsupported simple spiceCall argument metadata",
                        callName,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  return true;
}

static bool v2_dispatch_simple_spice_call(const V2SpiceCallSpec *callSpec,
                                          const V2SimpleSpiceCallArgs *args,
                                          V2RefEntry *refs,
                                          SpiceInt *scalarOut) {
  if (callSpec->executionKind == V2_SPICE_CALL_EXEC_SIMPLE_SCALAR_INT) {
    int refIndex = args->cellOrWindowRefIndices[0];
    if (refIndex < 0) {
      return false;
    }

    if (callSpec->id == V2_SPICE_CALL_CARD_C) {
      *scalarOut = card_c(&refs[refIndex].cell);
      return true;
    }

    if (callSpec->id == V2_SPICE_CALL_SIZE_C) {
      *scalarOut = size_c(&refs[refIndex].cell);
      return true;
    }

    return false;
  }

  if (callSpec->executionKind == V2_SPICE_CALL_EXEC_SIMPLE_VOID) {
    if (callSpec->cellWritebackArgIndex < 0 ||
        callSpec->cellWritebackArgIndex >= V2_SPICE_CALL_MAX_ARGS) {
      return false;
    }

    int refIndex = args->cellOrWindowRefIndices[callSpec->cellWritebackArgIndex];
    if (refIndex < 0) {
      return false;
    }

    SpiceCell *cellValue = &refs[refIndex].cell;
    if (callSpec->id == V2_SPICE_CALL_SCARD_C) {
      scard_c(args->intArgs[0], cellValue);
    } else if (callSpec->id == V2_SPICE_CALL_SSIZE_C) {
      ssize_c(args->intArgs[0], cellValue);
    } else if (callSpec->id == V2_SPICE_CALL_VALID_C) {
      valid_c(args->intArgs[0], args->intArgs[1], cellValue);
    } else {
      return false;
    }

    return true;
  }

  return false;
}

static bool v2_execute_simple_spice_call(const char *json,
                                         const jsmntok_t *tokens,
                                         int tokenCount,
                                         int inTok,
                                         int asTok,
                                         int argsTok,
                                         V2RefEntry *refs,
                                         int *refCount,
                                         const V2SpiceCallSpec *callSpec,
                                         const char *callName) {
  if (callSpec->arity > V2_SPICE_CALL_MAX_ARGS) {
    write_error_json_ex("invalid_request",
                        "Unsupported generic v2 spiceCall arity metadata",
                        callName,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  if (callSpec->executionKind == V2_SPICE_CALL_EXEC_SIMPLE_VOID &&
      (callSpec->cellWritebackArgIndex < 0 ||
       callSpec->cellWritebackArgIndex >= (int)callSpec->arity ||
       callSpec->cellWritebackArgIndex >= V2_SPICE_CALL_MAX_ARGS)) {
    write_error_json_ex("invalid_request",
                        "Unsupported generic v2 spiceCall writeback metadata",
                        callName,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  V2SimpleSpiceCallArgs args;
  if (!v2_resolve_simple_spice_call_args(json,
                                         tokens,
                                         tokenCount,
                                         inTok,
                                         argsTok,
                                         refs,
                                         *refCount,
                                         callSpec,
                                         callName,
                                         &args)) {
    return false;
  }

  SpiceInt scalarOut = 0;
  reset_c();
  if (!v2_dispatch_simple_spice_call(callSpec, &args, refs, &scalarOut)) {
    write_error_json_ex("invalid_request",
                        "Unsupported generic v2 spiceCall metadata",
                        callName,
                        NULL,
                        NULL,
                        NULL);
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
    return false;
  }

  if (callSpec->outputPolicy != V2_SPICE_CALL_OUTPUT_REQUIRED) {
    return true;
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
    return false;
  }

  bool ok = v2_add_ref_int(refs, refCount, asName, scalarOut);
  free(asName);
  return ok;
}

static bool v2_execute_minimal_dsk_selector_int_spice_call(
    const char *json, const jsmntok_t *tokens, int tokenCount, int inTok,
    int asTok, V2RefEntry *refs, int *refCount, const V2SpiceCallSpec *callSpec,
    const char *callName) {
  int selectorTok = jsmn_get_array_elem(tokens, inTok, 0, tokenCount);
  if (selectorTok < 0 || selectorTok >= tokenCount ||
      tokens[selectorTok].type != JSMN_STRING) {
    write_error_json_ex(
        "invalid_args",
        "spiceCall dskgd_c/dskb02_c selector must be a string",
        NULL,
        NULL,
        NULL,
        NULL);
    return false;
  }

  char selectorDetail[256];
  selectorDetail[0] = '\0';
  char *selector = NULL;
  jsmn_strdup_err_t selectorErr =
      jsmn_strdup(json, &tokens[selectorTok], &selector, selectorDetail,
                  sizeof(selectorDetail));
  if (selectorErr != JSMN_STRDUP_OK) {
    if (selectorErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          selectorDetail[0] ? selectorDetail : NULL, NULL, NULL,
                          NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  bool selectorOk = false;
  if (callSpec->id == V2_SPICE_CALL_DSKGD_C) {
    selectorOk = (strcmp(selector, "surfce") == 0 ||
                  strcmp(selector, "center") == 0);
  } else if (callSpec->id == V2_SPICE_CALL_DSKB02_C) {
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
    return false;
  }

  char tempPath[PATH_MAX];
  if (!v2_write_minimal_dsk_file(
          callSpec->id == V2_SPICE_CALL_DSKGD_C ? "v2-dskgd" : "v2-dskb02",
          tempPath,
          sizeof(tempPath))) {
    free(selector);
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
    return false;
  }

  SpiceInt outValue = 0;
  if (callSpec->id == V2_SPICE_CALL_DSKGD_C) {
    SpiceDSKDescr dskdsc;
    dskgd_c(handle, &dladsc, &dskdsc);
    if (failed_c() == SPICETRUE) {
      char shortMsg[1841];
      char longMsg[1841];
      char traceMsg[1841];
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      dascls_c(handle);
      unlink(tempPath);
      free(selector);
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
      capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                          traceMsg, sizeof(traceMsg));
      dascls_c(handle);
      unlink(tempPath);
      free(selector);
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
    return false;
  }

  bool ok = v2_add_ref_int(refs, refCount, asName, outValue);
  free(asName);
  free(selector);
  return ok;
}

static bool v2_execute_minimal_dsk_body_id_presence_spice_call(
    const char *callName) {
  (void)callName;

  char tempPath[PATH_MAX];
  if (!v2_write_minimal_dsk_file("v2-dskobj", tempPath, sizeof(tempPath))) {
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
    write_error_json("SPICE error in card_c (dskobj)", shortMsg, longMsg,
                     traceMsg);
    return false;
  }

  if (bodyCount < 1) {
    unlink(tempPath);
    write_error_json_ex("invalid_request",
                        "spiceCall(dskobj_c) expected at least one body id",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  unlink(tempPath);
  return true;
}

static bool v2_execute_minimal_dsk_surface_id_presence_spice_call(
    const char *callName) {
  (void)callName;

  char tempPath[PATH_MAX];
  if (!v2_write_minimal_dsk_file("v2-dsksrf", tempPath, sizeof(tempPath))) {
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
    write_error_json("SPICE error in card_c (dsksrf body ids)", shortMsg,
                     longMsg, traceMsg);
    return false;
  }

  if (bodyCount < 1) {
    unlink(tempPath);
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
    write_error_json("SPICE error in card_c (dsksrf surface ids)", shortMsg,
                     longMsg, traceMsg);
    return false;
  }

  if (surfaceCount < 1) {
    unlink(tempPath);
    write_error_json_ex("invalid_request",
                        "spiceCall(dsksrf_c) expected at least one surface id",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  unlink(tempPath);
  return true;
}

static bool v2_execute_read_virtual_output_bytes_spice_call(void) {
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
    write_error_json("SPICE error in spkcls", shortMsg, longMsg, traceMsg);
    return false;
  }

  FILE *fp = fopen(tempPath, "rb");
  if (fp == NULL) {
    unlink(tempPath);
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
    char detailText[256];
    if (ftellErrno != 0) {
      snprintf(detailText, sizeof(detailText), "ftell failed: %s",
               strerror(ftellErrno));
    } else {
      snprintf(detailText, sizeof(detailText), "ftell failed: unknown error");
    }

    write_error_json_ex(
        "invalid_request",
        "readVirtualOutput could not determine temporary output file size",
        detailText,
        NULL,
        NULL,
        NULL);
    return false;
  }

  if (fileBytes == 0) {
    write_error_json_ex("invalid_request",
                        "readVirtualOutput expected non-empty output bytes",
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  return true;
}

static bool v2_execute_legacy_dskopn_spice_call(void) {
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
    write_error_json("SPICE error in dascls", shortMsg, longMsg, traceMsg);
    return false;
  }

  unlink(tempPath);
  return true;
}

static bool v2_execute_legacy_dskmi2_spice_call(void) {
  if ((size_t)DSK_MINIMAL_WORKSZ > SIZE_MAX / sizeof(SpiceInt[2])) {
    write_error_json("Out of memory", NULL, NULL, NULL);
    return false;
  }

  SpiceInt(*work)[2] = (SpiceInt(*)[2])malloc(sizeof(SpiceInt[2]) *
                                              (size_t)DSK_MINIMAL_WORKSZ);
  if (work == NULL) {
    write_error_json("Out of memory", NULL, NULL, NULL);
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
    write_error_json("SPICE error in dskmi2", shortMsg, longMsg, traceMsg);
    return false;
  }

  return true;
}

static bool v2_execute_legacy_dskw02_spice_call(void) {
  char tempPath[PATH_MAX];
  if (!v2_write_minimal_dsk_file("v2-dskw02", tempPath, sizeof(tempPath))) {
    return false;
  }

  unlink(tempPath);
  return true;
}

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
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    return false;
  }

  char callDetail[256];
  callDetail[0] = '\0';
  char *callName = NULL;
  jsmn_strdup_err_t callErr =
      jsmn_strdup(json, &tokens[callTok], &callName, callDetail,
                  sizeof(callDetail));
  if (callErr != JSMN_STRDUP_OK) {
    if (callErr == JSMN_STRDUP_INVALID) {
      write_error_json_ex("invalid_request", "Invalid JSON string escape",
                          callDetail[0] ? callDetail : NULL, NULL, NULL, NULL);
    } else {
      write_error_json("Out of memory", NULL, NULL, NULL);
    }
    return false;
  }

  const V2SpiceCallSpec *callSpec = v2_lookup_spice_call_spec(callName);
  if (callSpec == NULL) {
    write_error_json_ex("unsupported_call",
                        "Unsupported v2 spiceCall",
                        callName,
                        NULL,
                        NULL,
                        NULL);
    free(callName);
    return false;
  }

  const int inputCount = tokens[inTok].size;
  if (inputCount != (int)callSpec->arity) {
    char fallback[96];
    snprintf(fallback,
             sizeof(fallback),
             "spiceCall %s expects %d input%s",
             callName,
             callSpec->arity,
             (callSpec->arity == 1) ? "" : "s");
    write_error_json_ex("invalid_request",
                        callSpec->arityErrorMessage != NULL
                            ? callSpec->arityErrorMessage
                            : fallback,
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    free(callName);
    return false;
  }

  if (callSpec->outputPolicy == V2_SPICE_CALL_OUTPUT_FORBIDDEN && asTok >= 0) {
    char fallback[128];
    snprintf(fallback, sizeof(fallback), "spiceCall %s does not allow as",
             callName);
    write_error_json_ex("invalid_request",
                        fallback,
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    free(callName);
    return false;
  }

  if (callSpec->outputPolicy == V2_SPICE_CALL_OUTPUT_REQUIRED &&
      (asTok < 0 || tokens[asTok].type != JSMN_STRING)) {
    char fallback[96];
    snprintf(fallback, sizeof(fallback), "spiceCall %s requires string as",
             callName);
    write_error_json_ex("invalid_request",
                        callSpec->missingOutputErrorMessage != NULL
                            ? callSpec->missingOutputErrorMessage
                            : fallback,
                        NULL,
                        NULL,
                        NULL,
                        NULL);
    free(callName);
    return false;
  }

  bool ok = false;

  switch (callSpec->executionKind) {
  case V2_SPICE_CALL_EXEC_SIMPLE_SCALAR_INT:
  case V2_SPICE_CALL_EXEC_SIMPLE_VOID:
    ok = v2_execute_simple_spice_call(json,
                                      tokens,
                                      tokenCount,
                                      inTok,
                                      asTok,
                                      argsTok,
                                      refs,
                                      refCount,
                                      callSpec,
                                      callName);
    break;

  case V2_SPICE_CALL_EXEC_MINIMAL_DSK_SELECTOR_INT:
    ok = v2_execute_minimal_dsk_selector_int_spice_call(
        json,
        tokens,
        tokenCount,
        inTok,
        asTok,
        refs,
        refCount,
        callSpec,
        callName);
    break;

  case V2_SPICE_CALL_EXEC_MINIMAL_DSK_BODY_ID_PRESENCE:
    ok = v2_execute_minimal_dsk_body_id_presence_spice_call(callName);
    break;

  case V2_SPICE_CALL_EXEC_MINIMAL_DSK_SURFACE_ID_PRESENCE:
    ok = v2_execute_minimal_dsk_surface_id_presence_spice_call(callName);
    break;

  case V2_SPICE_CALL_EXEC_READ_VIRTUAL_OUTPUT_BYTES:
    ok = v2_execute_read_virtual_output_bytes_spice_call();
    break;

  case V2_SPICE_CALL_EXEC_LEGACY:
    if (callSpec->id == V2_SPICE_CALL_DSKOPN_C) {
      ok = v2_execute_legacy_dskopn_spice_call();
    } else if (callSpec->id == V2_SPICE_CALL_DSKMI2_C) {
      ok = v2_execute_legacy_dskmi2_spice_call();
    } else if (callSpec->id == V2_SPICE_CALL_DSKW02_C) {
      ok = v2_execute_legacy_dskw02_spice_call();
    } else {
      write_error_json_ex("invalid_request",
                          "Unsupported legacy v2 spiceCall metadata",
                          callName,
                          NULL,
                          NULL,
                          NULL);
      ok = false;
    }
    break;

  default:
    write_error_json_ex("invalid_request",
                        "Unsupported v2 spiceCall execution metadata",
                        callName,
                        NULL,
                        NULL,
                        NULL);
    ok = false;
    break;
  }

  free(callName);
  return ok;
}
