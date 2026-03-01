#include "cspice_runner_json_emit.h"
#include "cspice_runner_v2_call_spec.h"
#include "cspice_runner_v2_refs.h"
#include "cspice_runner_v2_spice_call.h"
#include "cspice_runner_v2_spice_invoke.h"

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

  V2SpiceCallInvokeContext invokeContext = {
      .json = json,
      .tokens = tokens,
      .tokenCount = tokenCount,
      .callName = callName,
      .spec = spec,
      .asRefName = asRefName,
      .outMapTok = outMapTok,
      .resolved = &resolved,
      .refs = refs,
      .refCount = refCount,
  };

  bool ok = v2_invoke_spice_call(&invokeContext);

  v2_free_resolved_args(&resolved);
  free(callName);
  free(asRefName);
  return ok;
}
