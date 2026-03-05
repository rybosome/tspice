#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_temp_files.h"
#include "cspice_runner_v2_fixtures.h"
#include "cspice_runner_v2_call_invoke.h"

#include <string.h>

static bool v2_strdup_json_token(const char *json, const jsmntok_t *tok,
                                 char **out) {
  char detail[256];
  detail[0] = '\0';
  jsmn_strdup_err_t err = jsmn_strdup(json, tok, out, detail, sizeof(detail));
  if (err == JSMN_STRDUP_OK) {
    return true;
  }

  if (err == JSMN_STRDUP_INVALID) {
    write_error_json_ex("invalid_request", "Invalid JSON string escape",
                        detail[0] ? detail : NULL, NULL, NULL, NULL);
  } else {
    write_error_json("Out of memory", NULL, NULL, NULL);
  }

  return false;
}

static bool v2_write_spice_failure(const char *messagePrefix) {
  char shortMsg[1841];
  char longMsg[1841];
  char traceMsg[1841];
  capture_spice_error(shortMsg, sizeof(shortMsg), longMsg, sizeof(longMsg),
                      traceMsg, sizeof(traceMsg));
  write_error_json_ex("spice_error", messagePrefix, NULL, shortMsg, longMsg,
                      traceMsg);
  return false;
}

static bool v2_execute_dskopn_legacy_call(void) {
  char tempPath[PATH_MAX];
  char detail[256];
  detail[0] = '\0';
  int tempFd = -1;
  if (!build_file_io_temp_path("v2-dskopn", ".bds", tempPath,
                               sizeof(tempPath), &tempFd, detail,
                               sizeof(detail))) {
    write_error_json_ex("invalid_request", "Failed to create DSK temp path",
                        detail[0] ? detail : NULL, NULL, NULL, NULL);
    return false;
  }

  if (tempFd >= 0) {
    close(tempFd);
    tempFd = -1;
  }
  unlink(tempPath);

  SpiceInt handle = 0;
  dskopn_c(tempPath, "TSPICE", 0, &handle);
  if (failed_c() == SPICETRUE) {
    unlink(tempPath);
    return v2_write_spice_failure("SPICE error in dskopn_c");
  }

  dascls_c(handle);
  if (failed_c() == SPICETRUE) {
    unlink(tempPath);
    return v2_write_spice_failure("SPICE error in dascls_c");
  }

  unlink(tempPath);
  return true;
}

static bool v2_execute_dskmi2_legacy_call(void) {
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
    return v2_write_spice_failure("SPICE error in dskmi2_c");
  }

  if (SPICE_DSK02_IXDFIX <= 0 || DSK_MINIMAL_SPXISZ <= 0 ||
      spaixd[0] != spaixd[0] || spaixi[0] < 0) {
    write_error_json_ex("invalid_request",
                        "call dskmi2_c expected non-empty outputs",
                        NULL, NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_execute_dskw02_legacy_call(void) {
  char tempPath[PATH_MAX];
  if (!v2_write_minimal_dsk_file("v2-dskw02", tempPath, sizeof(tempPath))) {
    return false;
  }

  unlink(tempPath);
  return true;
}

static bool v2_execute_read_virtual_output_call(const char *path) {
  FILE *fp = fopen(path, "rb");
  if (fp == NULL) {
    char detail[384];
    snprintf(detail, sizeof(detail), "%s (%s)", path, strerror(errno));
    write_error_json_ex("invalid_request",
                        "call readVirtualOutput failed to open file",
                        detail, NULL, NULL, NULL);
    return false;
  }

  if (fseek(fp, 0, SEEK_END) != 0) {
    fclose(fp);
    write_error_json_ex("invalid_request",
                        "call readVirtualOutput could not read file size",
                        path, NULL, NULL, NULL);
    return false;
  }

  long size = ftell(fp);
  fclose(fp);
  if (size <= 0) {
    write_error_json_ex("invalid_request",
                        "call readVirtualOutput expected non-empty bytes",
                        path, NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_try_resolve_named_dskb02_value(const char *name,
                                               SpiceInt nv,
                                               SpiceInt np,
                                               SpiceInt nvxtot,
                                               SpiceInt cgscal,
                                               SpiceInt vtxnpl,
                                               SpiceInt voxnpt,
                                               SpiceInt voxnpl,
                                               SpiceInt *out) {
  if (strcmp(name, "nv") == 0) {
    *out = nv;
    return true;
  }
  if (strcmp(name, "np") == 0) {
    *out = np;
    return true;
  }
  if (strcmp(name, "nvxtot") == 0) {
    *out = nvxtot;
    return true;
  }
  if (strcmp(name, "cgscal") == 0) {
    *out = cgscal;
    return true;
  }
  if (strcmp(name, "vtxnpl") == 0) {
    *out = vtxnpl;
    return true;
  }
  if (strcmp(name, "voxnpt") == 0) {
    *out = voxnpt;
    return true;
  }
  if (strcmp(name, "voxnpl") == 0) {
    *out = voxnpl;
    return true;
  }

  return false;
}

static bool v2_emit_named_dskb02_outputs(const char *json,
                                         const jsmntok_t *tokens,
                                         int tokenCount,
                                         int outMapTok,
                                         V2RefEntry *refs,
                                         int *refCount,
                                         SpiceInt nv,
                                         SpiceInt np,
                                         SpiceInt nvxtot,
                                         SpiceInt cgscal,
                                         SpiceInt vtxnpl,
                                         SpiceInt voxnpt,
                                         SpiceInt voxnpl) {
  const int pairCount = jsmn_object_pair_count(&tokens[outMapTok]);
  if (pairCount < 0) {
    write_error_json_ex("invalid_request", "call out map parse error", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int idx = outMapTok + 1;
  for (int i = 0; i < pairCount; i++) {
    int keyTok = idx;
    int valueTok = idx + 1;
    if (valueTok >= tokenCount || tokens[keyTok].type != JSMN_STRING ||
        tokens[valueTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request", "call out map parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }

    char *outName = NULL;
    char *refName = NULL;
    if (!v2_strdup_json_token(json, &tokens[keyTok], &outName) ||
        !v2_strdup_json_token(json, &tokens[valueTok], &refName)) {
      free(outName);
      free(refName);
      return false;
    }

    SpiceInt value = 0;
    if (!v2_try_resolve_named_dskb02_value(outName,
                                            nv,
                                            np,
                                            nvxtot,
                                            cgscal,
                                            vtxnpl,
                                            voxnpt,
                                            voxnpl,
                                            &value)) {
      write_error_json_ex("invalid_args",
                          "Unsupported dskb02 named out param",
                          outName,
                          NULL,
                          NULL,
                          NULL);
      free(outName);
      free(refName);
      return false;
    }

    bool ok = v2_add_ref_int(refs, refCount, refName, value);
    free(outName);
    free(refName);
    if (!ok) {
      return false;
    }

    idx = jsmn_skip_subtree(tokens, valueTok, tokenCount);
    if (idx < 0) {
      write_error_json_ex("invalid_request", "call out map parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }
  }

  return true;
}

static bool v2_invoke_card(const V2CallInvokeContext *context) {
  SpiceInt value =
      card_c(&context->refs[context->resolved->refIndices[0]].cell);
  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in card_c");
  }

  return v2_add_ref_int(context->refs,
                        context->refCount,
                        context->asRefName,
                        value);
}

static bool v2_invoke_size(const V2CallInvokeContext *context) {
  SpiceInt value =
      size_c(&context->refs[context->resolved->refIndices[0]].cell);
  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in size_c");
  }

  return v2_add_ref_int(context->refs,
                        context->refCount,
                        context->asRefName,
                        value);
}

static bool v2_invoke_scard(const V2CallInvokeContext *context) {
  scard_c(context->resolved->intValues[0],
          &context->refs[context->resolved->refIndices[1]].cell);
  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in scard_c");
  }

  return true;
}

static bool v2_invoke_ssize(const V2CallInvokeContext *context) {
  ssize_c(context->resolved->intValues[0],
          &context->refs[context->resolved->refIndices[1]].cell);
  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in ssize_c");
  }

  return true;
}

static bool v2_invoke_valid(const V2CallInvokeContext *context) {
  valid_c(context->resolved->intValues[0],
          context->resolved->intValues[1],
          &context->refs[context->resolved->refIndices[2]].cell);
  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in valid_c");
  }

  return true;
}

static bool v2_invoke_dskobj(const V2CallInvokeContext *context) {
  dskobj_c(context->resolved->pathValues[0],
           &context->refs[context->resolved->refIndices[1]].cell);
  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in dskobj_c");
  }

  return true;
}

static bool v2_invoke_dsksrf(const V2CallInvokeContext *context) {
  dsksrf_c(context->resolved->pathValues[0],
           context->resolved->intValues[1],
           &context->refs[context->resolved->refIndices[2]].cell);
  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in dsksrf_c");
  }

  return true;
}

static bool v2_invoke_dskgd(const V2CallInvokeContext *context) {
  SpiceDSKDescr descriptor;
  memset(&descriptor, 0, sizeof(descriptor));

  dskgd_c(context->refs[context->resolved->refIndices[0]].handleValue,
          &context->refs[context->resolved->refIndices[1]].dlaDescrValue,
          &descriptor);
  if (failed_c() == SPICETRUE) {
    return v2_write_spice_failure("SPICE error in dskgd_c");
  }

  return v2_add_ref_dsk_descr(context->refs,
                              context->refCount,
                              context->asRefName,
                              &descriptor);
}

static bool v2_invoke_dskb02(const V2CallInvokeContext *context) {
  SpiceInt nv = 0;
  SpiceInt np = 0;
  SpiceInt nvxtot = 0;
  SpiceDouble vtxbds[3][2];
  SpiceDouble voxsiz = 0.0;
  SpiceDouble voxori[3];
  SpiceDouble vgrext[3];
  SpiceInt cgscal = 0;
  SpiceInt vtxnpl = 0;
  SpiceInt voxnpt = 0;
  SpiceInt voxnpl = 0;

  dskb02_c(context->refs[context->resolved->refIndices[0]].handleValue,
           &context->refs[context->resolved->refIndices[1]].dlaDescrValue,
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
    return v2_write_spice_failure("SPICE error in dskb02_c");
  }

  return v2_emit_named_dskb02_outputs(context->json,
                                      context->tokens,
                                      context->tokenCount,
                                      context->outMapTok,
                                      context->refs,
                                      context->refCount,
                                      nv,
                                      np,
                                      nvxtot,
                                      cgscal,
                                      vtxnpl,
                                      voxnpt,
                                      voxnpl);
}

static bool v2_invoke_dskopn(const V2CallInvokeContext *context) {
  (void)context;
  return v2_execute_dskopn_legacy_call();
}

static bool v2_invoke_dskmi2(const V2CallInvokeContext *context) {
  (void)context;
  return v2_execute_dskmi2_legacy_call();
}

static bool v2_invoke_dskw02(const V2CallInvokeContext *context) {
  (void)context;
  return v2_execute_dskw02_legacy_call();
}

static bool v2_invoke_read_virtual_output(
    const V2CallInvokeContext *context) {
  return v2_execute_read_virtual_output_call(context->resolved->pathValues[0]);
}

typedef bool (*V2CallInvokerFn)(const V2CallInvokeContext *context);

typedef struct {
  const char *symbol;
  V2CallInvokerFn invoke;
} V2CallInvokerEntry;

static const V2CallInvokerEntry V2_NATIVE_CALL_INVOKER_REGISTRY[] = {
    {.symbol = "card_c", .invoke = v2_invoke_card},
    {.symbol = "size_c", .invoke = v2_invoke_size},
    {.symbol = "scard_c", .invoke = v2_invoke_scard},
    {.symbol = "ssize_c", .invoke = v2_invoke_ssize},
    {.symbol = "valid_c", .invoke = v2_invoke_valid},
    {.symbol = "dskobj_c", .invoke = v2_invoke_dskobj},
    {.symbol = "dsksrf_c", .invoke = v2_invoke_dsksrf},
    {.symbol = "dskgd_c", .invoke = v2_invoke_dskgd},
    {.symbol = "dskb02_c", .invoke = v2_invoke_dskb02},
    {.symbol = "dskopn_c", .invoke = v2_invoke_dskopn},
    {.symbol = "dskmi2_c", .invoke = v2_invoke_dskmi2},
    {.symbol = "dskw02_c", .invoke = v2_invoke_dskw02},
    {.symbol = "readVirtualOutput", .invoke = v2_invoke_read_virtual_output},
};

static V2CallInvokerFn v2_lookup_call_invoker(const char *symbol) {
  const size_t count =
      sizeof(V2_NATIVE_CALL_INVOKER_REGISTRY) /
      sizeof(V2_NATIVE_CALL_INVOKER_REGISTRY[0]);

  if (symbol == NULL) {
    return NULL;
  }

  for (size_t i = 0; i < count; i++) {
    if (strcmp(V2_NATIVE_CALL_INVOKER_REGISTRY[i].symbol, symbol) == 0) {
      return V2_NATIVE_CALL_INVOKER_REGISTRY[i].invoke;
    }
  }

  return NULL;
}

bool v2_invoke_call(const V2CallInvokeContext *context) {
  if (context == NULL || context->spec == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  if (context->spec->invokeKind != V2_FUNCTION_INVOKE_SPICE) {
    write_error_json_ex("unsupported_call",
                        "Native call invoker supports spice functions only",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  V2CallInvokerFn invoker = v2_lookup_call_invoker(context->spec->cSymbol);
  if (invoker == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 call",
                        context->fnName, NULL, NULL, NULL);
    return false;
  }

  return invoker(context);
}
