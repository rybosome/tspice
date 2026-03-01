#include "cspice_runner_json_emit.h"
#include "cspice_runner_error.h"
#include "cspice_runner_v2_call_spec.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_spice_call.h"

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

static bool v2_resolve_path_expr(const char *json, const jsmntok_t *tokens,
                                 int tokenCount, int exprTok, int argsTok,
                                 V2RefEntry *refs, int refCount,
                                 const char *label, char **outPath) {
  if (exprTok < 0 || exprTok >= tokenCount ||
      tokens[exprTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_args", "Path expression must be a string", label,
                        NULL, NULL, NULL);
    return false;
  }

  char *expr = NULL;
  if (!v2_strdup_json_token(json, &tokens[exprTok], &expr)) {
    return false;
  }

  const char *argName = NULL;
  const char *refName = NULL;

  if (v2_parse_ref_name(expr, "$args.", &argName)) {
    int valueTok =
        jsmn_find_object_key(json, tokens, argsTok, argName, tokenCount);
    if (valueTok < 0 || tokens[valueTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_args", "Missing or invalid v2 string argument",
                          argName, NULL, NULL, NULL);
      free(expr);
      return false;
    }

    char *resolved = NULL;
    bool ok = v2_strdup_json_token(json, &tokens[valueTok], &resolved);
    free(expr);
    if (!ok) {
      return false;
    }

    *outPath = resolved;
    return true;
  }

  if (v2_parse_ref_name(expr, "$refs.", &refName)) {
    if (strchr(refName, '.') != NULL) {
      write_error_json_ex("invalid_args", "Ref must use $refs.<name>", refName,
                          NULL, NULL, NULL);
      free(expr);
      return false;
    }

    int refIndex = v2_find_ref_index(refs, refCount, refName);
    if (refIndex < 0) {
      write_error_json_ex("invalid_request", "Unknown v2 ref", refName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    if (refs[refIndex].type != V2_REF_PATH || refs[refIndex].pathValue == NULL) {
      write_error_json_ex("invalid_args", "v2 ref is not a path", refName, NULL,
                          NULL, NULL);
      free(expr);
      return false;
    }

    char *resolved = strdup(refs[refIndex].pathValue);
    free(expr);
    if (resolved == NULL) {
      write_error_json("Out of memory", NULL, NULL, NULL);
      return false;
    }

    *outPath = resolved;
    return true;
  }

  *outPath = expr;
  return true;
}

static bool v2_require_as_output_ref(const char *json, const jsmntok_t *tokens,
                                     int tokenCount, int stepTok,
                                     const V2SpiceCallSpec *spec,
                                     char **outName) {
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  if (asTok < 0 || tokens[asTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_args",
                        "spiceCall requires string \"as\" output ref",
                        spec->name, NULL, NULL, NULL);
    return false;
  }

  return v2_strdup_json_token(json, &tokens[asTok], outName);
}

static bool v2_forbid_as_output_ref(const char *json, const jsmntok_t *tokens,
                                    int tokenCount, int stepTok,
                                    const V2SpiceCallSpec *spec) {
  int asTok = jsmn_find_object_key(json, tokens, stepTok, "as", tokenCount);
  if (asTok >= 0) {
    write_error_json_ex("invalid_args",
                        "spiceCall does not allow \"as\" output ref",
                        spec->name, NULL, NULL, NULL);
    return false;
  }

  return true;
}

static bool v2_require_out_map(const char *json, const jsmntok_t *tokens,
                               int tokenCount, int stepTok,
                               const V2SpiceCallSpec *spec,
                               int *outMapTok) {
  int outTok = jsmn_find_object_key(json, tokens, stepTok, "out", tokenCount);
  if (outTok < 0 || tokens[outTok].type != JSMN_OBJECT) {
    write_error_json_ex("invalid_args",
                        "spiceCall requires object \"out\" map",
                        spec->name, NULL, NULL, NULL);
    return false;
  }

  *outMapTok = outTok;
  return true;
}

static bool v2_forbid_out_map(const char *json, const jsmntok_t *tokens,
                              int tokenCount, int stepTok,
                              const V2SpiceCallSpec *spec) {
  int outTok = jsmn_find_object_key(json, tokens, stepTok, "out", tokenCount);
  if (outTok >= 0) {
    write_error_json_ex("invalid_args", "spiceCall does not allow \"out\" map",
                        spec->name, NULL, NULL, NULL);
    return false;
  }

  return true;
}

typedef struct {
  SpiceInt intValues[V2_SPICE_CALL_MAX_ARITY];
  int refIndices[V2_SPICE_CALL_MAX_ARITY];
  char *pathValues[V2_SPICE_CALL_MAX_ARITY];
} V2ResolvedSpiceCallArgs;

static void v2_clear_resolved_args(V2ResolvedSpiceCallArgs *args) {
  memset(args, 0, sizeof(*args));
  for (int i = 0; i < V2_SPICE_CALL_MAX_ARITY; i++) {
    args->refIndices[i] = -1;
  }
}

static void v2_free_resolved_args(V2ResolvedSpiceCallArgs *args) {
  for (int i = 0; i < V2_SPICE_CALL_MAX_ARITY; i++) {
    free(args->pathValues[i]);
    args->pathValues[i] = NULL;
  }
}

static bool v2_resolve_call_args(const char *json, const jsmntok_t *tokens,
                                 int tokenCount, int stepTok, int argsTok,
                                 V2RefEntry *refs, int refCount,
                                 const V2SpiceCallSpec *spec,
                                 V2ResolvedSpiceCallArgs *out) {
  int inTok = jsmn_find_object_key(json, tokens, stepTok, "in", tokenCount);
  if (inTok < 0 || tokens[inTok].type != JSMN_ARRAY) {
    write_error_json_ex("invalid_request", "spiceCall requires array \"in\"",
                        spec->name, NULL, NULL, NULL);
    return false;
  }

  if (tokens[inTok].size != spec->arity) {
    char msg[128];
    snprintf(msg, sizeof(msg), "spiceCall expects %d input(s)", spec->arity);
    write_error_json_ex("invalid_request", msg, spec->name, NULL, NULL, NULL);
    return false;
  }

  v2_clear_resolved_args(out);

  int idx = inTok + 1;
  for (int i = 0; i < spec->arity; i++) {
    int valueTok = idx;
    switch (spec->argKinds[i]) {
    case V2_SPICE_CALL_ARG_INT_EXPR: {
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_spiceint_expr(json,
                                    tokens,
                                    tokenCount,
                                    valueTok,
                                    argsTok,
                                    refs,
                                    refCount,
                                    label,
                                    &out->intValues[i])) {
        v2_free_resolved_args(out);
        return false;
      }

      if ((spec->nonNegativeIntArgMask & (1U << i)) != 0U &&
          out->intValues[i] < 0) {
        write_error_json_ex("invalid_args", "spiceCall integer input must be >= 0",
                            spec->name, NULL, NULL, NULL);
        v2_free_resolved_args(out);
        return false;
      }
      break;
    }

    case V2_SPICE_CALL_ARG_CELL_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_cell_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }

    case V2_SPICE_CALL_ARG_CELL_OR_WINDOW_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_cell_or_window_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }

    case V2_SPICE_CALL_ARG_PATH_EXPR: {
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_path_expr(json,
                                tokens,
                                tokenCount,
                                valueTok,
                                argsTok,
                                refs,
                                refCount,
                                label,
                                &out->pathValues[i])) {
        v2_free_resolved_args(out);
        return false;
      }
      break;
    }

    case V2_SPICE_CALL_ARG_DAS_HANDLE_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_das_handle_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }

    case V2_SPICE_CALL_ARG_DLA_DESCR_REF: {
      int refIndex = -1;
      char label[128];
      snprintf(label, sizeof(label), "spiceCall(%s).in[%d]", spec->name, i);
      if (!v2_resolve_dla_descr_ref(
              json, tokens, tokenCount, valueTok, refs, refCount, label,
              &refIndex)) {
        v2_free_resolved_args(out);
        return false;
      }
      out->refIndices[i] = refIndex;
      break;
    }
    }

    idx = jsmn_skip_subtree(tokens, valueTok, tokenCount);
    if (idx < 0) {
      write_error_json_ex("invalid_request", "spiceCall input parse error", NULL,
                          NULL, NULL, NULL);
      v2_free_resolved_args(out);
      return false;
    }
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
    write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  int idx = outMapTok + 1;
  for (int i = 0; i < pairCount; i++) {
    int keyTok = idx;
    int valueTok = idx + 1;
    if (valueTok >= tokenCount || tokens[keyTok].type != JSMN_STRING ||
        tokens[valueTok].type != JSMN_STRING) {
      write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
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
      write_error_json_ex("invalid_request", "spiceCall out map parse error", NULL,
                          NULL, NULL, NULL);
      return false;
    }
  }

  return true;
}

bool v2_execute_spice_call_step(const char *json, const jsmntok_t *tokens,
                                int tokenCount, int stepTok,
                                int argsTok, V2RefEntry *refs,
                                int *refCount) {
  int callTok = jsmn_find_object_key(json, tokens, stepTok, "call", tokenCount);
  if (callTok < 0 || tokens[callTok].type != JSMN_STRING) {
    write_error_json_ex("invalid_request", "spiceCall requires string call", NULL,
                        NULL, NULL, NULL);
    return false;
  }

  char *callName = NULL;
  if (!v2_strdup_json_token(json, &tokens[callTok], &callName)) {
    return false;
  }

  const V2SpiceCallSpec *spec = v2_lookup_spice_call_spec(callName);
  if (spec == NULL) {
    write_error_json_ex("unsupported_call", "Unsupported v2 spiceCall", callName,
                        NULL, NULL, NULL);
    free(callName);
    return false;
  }

  char *asRefName = NULL;
  int outMapTok = -1;
  switch (spec->outputKind) {
  case V2_SPICE_CALL_OUTPUT_AS_INT:
  case V2_SPICE_CALL_OUTPUT_AS_DSK_DESCR:
    if (!v2_require_as_output_ref(
            json, tokens, tokenCount, stepTok, spec, &asRefName) ||
        !v2_forbid_out_map(json, tokens, tokenCount, stepTok, spec)) {
      free(callName);
      free(asRefName);
      return false;
    }
    break;

  case V2_SPICE_CALL_OUTPUT_NAMED_DSKB02:
    if (!v2_forbid_as_output_ref(json, tokens, tokenCount, stepTok, spec) ||
        !v2_require_out_map(json,
                            tokens,
                            tokenCount,
                            stepTok,
                            spec,
                            &outMapTok)) {
      free(callName);
      return false;
    }
    break;

  case V2_SPICE_CALL_OUTPUT_FORBIDDEN:
    if (!v2_forbid_as_output_ref(json, tokens, tokenCount, stepTok, spec) ||
        !v2_forbid_out_map(json, tokens, tokenCount, stepTok, spec)) {
      free(callName);
      return false;
    }
    break;
  }

  V2ResolvedSpiceCallArgs resolved;
  if (!v2_resolve_call_args(json,
                            tokens,
                            tokenCount,
                            stepTok,
                            argsTok,
                            refs,
                            *refCount,
                            spec,
                            &resolved)) {
    free(callName);
    free(asRefName);
    return false;
  }

  bool ok = true;
  switch (spec->id) {
  case V2_SPICE_CALL_CARD: {
    SpiceInt value = card_c(&refs[resolved.refIndices[0]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in card_c");
      break;
    }

    ok = v2_add_ref_int(refs, refCount, asRefName, value);
    break;
  }

  case V2_SPICE_CALL_SIZE: {
    SpiceInt value = size_c(&refs[resolved.refIndices[0]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in size_c");
      break;
    }

    ok = v2_add_ref_int(refs, refCount, asRefName, value);
    break;
  }

  case V2_SPICE_CALL_SCARD:
    scard_c(resolved.intValues[0], &refs[resolved.refIndices[1]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in scard_c");
    }
    break;

  case V2_SPICE_CALL_SSIZE:
    ssize_c(resolved.intValues[0], &refs[resolved.refIndices[1]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in ssize_c");
    }
    break;

  case V2_SPICE_CALL_VALID:
    valid_c(resolved.intValues[0],
            resolved.intValues[1],
            &refs[resolved.refIndices[2]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in valid_c");
    }
    break;

  case V2_SPICE_CALL_DSKOBJ:
    dskobj_c(resolved.pathValues[0], &refs[resolved.refIndices[1]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in dskobj_c");
    }
    break;

  case V2_SPICE_CALL_DSKSRF:
    dsksrf_c(resolved.pathValues[0],
             resolved.intValues[1],
             &refs[resolved.refIndices[2]].cell);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in dsksrf_c");
    }
    break;

  case V2_SPICE_CALL_DSKGD: {
    SpiceDSKDescr descriptor;
    memset(&descriptor, 0, sizeof(descriptor));
    dskgd_c(refs[resolved.refIndices[0]].handleValue,
            &refs[resolved.refIndices[1]].dlaDescrValue,
            &descriptor);
    if (failed_c() == SPICETRUE) {
      ok = v2_write_spice_failure("SPICE error in dskgd_c");
      break;
    }

    ok = v2_add_ref_dsk_descr(refs, refCount, asRefName, &descriptor);
    break;
  }

  case V2_SPICE_CALL_DSKB02: {
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

    dskb02_c(refs[resolved.refIndices[0]].handleValue,
             &refs[resolved.refIndices[1]].dlaDescrValue,
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
      ok = v2_write_spice_failure("SPICE error in dskb02_c");
      break;
    }

    ok = v2_emit_named_dskb02_outputs(json,
                                      tokens,
                                      tokenCount,
                                      outMapTok,
                                      refs,
                                      refCount,
                                      nv,
                                      np,
                                      nvxtot,
                                      cgscal,
                                      vtxnpl,
                                      voxnpt,
                                      voxnpl);
    break;
  }

  case V2_SPICE_CALL_UNKNOWN:
  default:
    write_error_json_ex("unsupported_call", "Unsupported v2 spiceCall", callName,
                        NULL, NULL, NULL);
    ok = false;
    break;
  }

  v2_free_resolved_args(&resolved);
  free(callName);
  free(asRefName);
  return ok;
}
